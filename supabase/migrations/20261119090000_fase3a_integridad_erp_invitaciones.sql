-- Fase 3A (aditiva, compatible con la web desplegada).
--  1. Dinero en numeric + restricciones + indices
--  2. Auditoria: updated_at, referencia, moneda, revisor, motivo, historial de estados
--  3. Base ERP: codigos contables, ids externos, cola de eventos (erp_outbox) y exportacion JSON de una hoja
--  4. Codigos de invitacion de organizacion (RPC) para dejar de usar el NIF como "codigo de empresa"
--  5. Preparacion de adjuntos privados: foto_path + politicas de storage por hoja
-- El cierre (organizaciones, alta directa de empleados, bucket privado) va en la migracion 3B,
-- que solo se aplica cuando la web nueva ya esta desplegada.

-- ============================================================ 0. utilidades
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function pg_temp.urldecode(t text) returns text language sql immutable as $$
  select convert_from(
    decode(string_agg(case when length(m[1]) = 1 then encode(convert_to(m[1], 'SQL_ASCII'), 'hex') else substr(m[1], 2, 2) end, ''), 'hex'),
    'UTF8')
  from regexp_matches(t, '%[0-9a-fA-F][0-9a-fA-F]|.', 'g') as r(m)
$$;

-- ============================================================ 1. dinero y restricciones
-- Las vistas dependen de las columnas que cambian de tipo: se recrean al final.
drop view if exists public.expense_dashboard_stats;
drop view if exists public.expense_sheet_with_total;
-- Vista heredada en el esquema `views` (sin permisos para ningun rol de la API): tambien depende de `amount`; se recrea al final con el mismo contenido.
drop view if exists views.expense_sheet_with_total;

alter table public."Expense_line"
  alter column amount type numeric(12,2) using round(amount::numeric, 2),
  alter column tax    type numeric(5,2)  using round(tax::numeric, 2);

alter table public."Expense_line"
  alter column title set not null, alter column amount set not null, alter column tax set not null,
  alter column id_payment_type set not null, alter column id_category set not null, alter column id_sheet set not null,
  add constraint expense_line_amount_chk check (amount > 0 and amount < 10000000),
  add constraint expense_line_tax_chk    check (tax >= 0 and tax <= 100),
  add constraint expense_line_title_chk  check (btrim(title) <> '');

alter table public."Expense_sheet"
  alter column title set not null, alter column id_user set not null,
  alter column id_status set not null, alter column id_status set default 1,
  alter column description set default '',
  add constraint expense_sheet_title_chk check (btrim(title) <> '');

alter table public."Organization" alter column name set not null;
create unique index if not exists organization_vat_key on public."Organization" (upper(btrim("VAT_number"))) where "VAT_number" is not null;

create index if not exists expense_line_sheet_idx      on public."Expense_line" (id_sheet);
create index if not exists expense_line_category_idx   on public."Expense_line" (id_category);
create index if not exists expense_line_payment_idx    on public."Expense_line" (id_payment_type);
create index if not exists expense_sheet_user_idx      on public."Expense_sheet" (id_user, create_date desc);
create index if not exists expense_sheet_status_idx    on public."Expense_sheet" (id_status);
create index if not exists employees_org_idx           on public.employees (id_organization);
create index if not exists employees_admin_idx         on public.employees (id_admin);

-- ============================================================ 2. auditoria
alter table public."Expense_sheet"
  add column if not exists updated_at  timestamptz not null default now(),
  add column if not exists reviewed_by uuid references public.employees(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text,
  add column if not exists currency    char(3) not null default 'EUR',
  add column if not exists cost_center text,
  add column if not exists erp_id      text,
  add column if not exists reference   text generated always as ('HG-' || lpad(id::text, 6, '0')) stored;

alter table public."Expense_line"
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists erp_id     text,
  add column if not exists foto_path  text;

-- hojas ya aprobadas: la fecha de revision es la de aprobacion que ya existia
update public."Expense_sheet" set reviewed_at = approval_date::timestamptz where id_status in (2, 3) and approval_date is not null;

create unique index if not exists expense_sheet_erp_key on public."Expense_sheet" (erp_id) where erp_id is not null;
create unique index if not exists expense_line_erp_key  on public."Expense_line"  (erp_id) where erp_id is not null;

drop trigger if exists zz_sheet_updated_at on public."Expense_sheet";
create trigger zz_sheet_updated_at before update on public."Expense_sheet" for each row execute function public.set_updated_at();
drop trigger if exists zz_line_updated_at on public."Expense_line";
create trigger zz_line_updated_at before update on public."Expense_line" for each row execute function public.set_updated_at();

-- Historial de estados (lo escribe solo la base de datos)
create table if not exists public."Sheet_status_history" (
  id              bigint generated always as identity primary key,
  id_sheet        bigint not null references public."Expense_sheet"(id) on delete cascade,
  from_status     bigint references public."Sheet_status"(id),
  to_status       bigint not null references public."Sheet_status"(id),
  changed_by      uuid references public.employees(id) on delete set null,
  changed_by_name text,
  note            text,
  changed_at      timestamptz not null default now()
);
create index if not exists sheet_history_sheet_idx on public."Sheet_status_history" (id_sheet, changed_at);
alter table public."Sheet_status_history" enable row level security;
drop policy if exists history_select on public."Sheet_status_history";
create policy history_select on public."Sheet_status_history" for select to authenticated
  using (exists (select 1 from public."Expense_sheet" s where s.id = id_sheet));
revoke all on public."Sheet_status_history" from anon, authenticated;
grant select on public."Sheet_status_history" to authenticated;

insert into public."Sheet_status_history" (id_sheet, from_status, to_status, changed_by, changed_by_name, changed_at)
  select s.id, null, 1, s.id_user, e.name, s.create_date from public."Expense_sheet" s left join public.employees e on e.id = s.id_user;
insert into public."Sheet_status_history" (id_sheet, from_status, to_status, changed_at)
  select s.id, 1, s.id_status, coalesce(s.approval_date::timestamptz, s.create_date) from public."Expense_sheet" s where s.id_status in (2, 3);

create or replace function public.expense_sheet_history() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  who uuid := public.my_employee_id();
  who_name text;
begin
  select e.name into who_name from public.employees e where e.id = who;
  if tg_op = 'INSERT' then
    insert into public."Sheet_status_history" (id_sheet, from_status, to_status, changed_by, changed_by_name)
    values (new.id, null, new.id_status, coalesce(who, new.id_user), who_name);
  elsif new.id_status is distinct from old.id_status then
    insert into public."Sheet_status_history" (id_sheet, from_status, to_status, changed_by, changed_by_name, note)
    values (new.id, old.id_status, new.id_status, who, who_name, new.review_note);
  end if;
  return null;
end $$;
revoke all on function public.expense_sheet_history() from public, anon, authenticated;
drop trigger if exists expense_sheet_history_ins on public."Expense_sheet";
create trigger expense_sheet_history_ins after insert on public."Expense_sheet" for each row execute function public.expense_sheet_history();
drop trigger if exists expense_sheet_history_upd on public."Expense_sheet";
create trigger expense_sheet_history_upd after update of id_status on public."Expense_sheet" for each row execute function public.expense_sheet_history();

-- ============================================================ 3. base ERP
alter table public."Expense_category"     add column if not exists account_code text;
alter table public."Expense_payment_type" add column if not exists erp_code text;
alter table public."Organization"         add column if not exists erp_id text;
alter table public.employees              add column if not exists erp_id text;
create unique index if not exists organization_erp_key on public."Organization" (erp_id) where erp_id is not null;
create unique index if not exists employees_erp_key    on public.employees (erp_id) where erp_id is not null;

-- el mapa contable que ya existia (Expense_account) pasa a la categoria
update public."Expense_category" c set account_code = a.account_number::text
  from public."Expense_account" a where a.id_category = c.id and c.account_code is null;
comment on table public."Expense_account" is 'OBSOLETA desde la fase 3: usar Expense_category.account_code';

-- los clientes no escriben ids externos
create or replace function public.expense_line_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.role() is not distinct from 'authenticated' then
    if tg_op = 'INSERT' then
      new.erp_id := null;
    elsif new.erp_id is distinct from old.erp_id then
      new.erp_id := old.erp_id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists expense_line_guard on public."Expense_line";
create trigger expense_line_guard before insert or update on public."Expense_line" for each row execute function public.expense_line_guard();

-- Cola de eventos hacia el ERP: solo la lee/escribe el backend (service_role) y los triggers
create table if not exists public.erp_outbox (
  id           bigint generated always as identity primary key,
  entity       text not null,
  entity_id    text not null,
  event        text not null,
  payload      jsonb not null,
  created_at   timestamptz not null default now(),
  processed_at timestamptz,
  attempts     int not null default 0,
  last_error   text
);
create index if not exists erp_outbox_pending_idx on public.erp_outbox (created_at) where processed_at is null;
alter table public.erp_outbox enable row level security;
revoke all on public.erp_outbox from anon, authenticated;
grant all on public.erp_outbox to service_role;

-- Exportacion JSON de una hoja para integrar con un ERP.
-- SUPUESTO (a confirmar): `amount` es el total CON IVA; base e IVA se derivan de `tax` (%).
create or replace function public.sheet_export(p_id bigint) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'reference', s.reference, 'id', s.id, 'title', s.title, 'description', s.description, 'project', s.project,
    'cost_center', s.cost_center, 'currency', s.currency, 'status', st.name, 'erp_id', s.erp_id,
    'created_at', s.create_date, 'reviewed_at', s.reviewed_at, 'review_note', s.review_note,
    'amounts_include_tax', true,
    'employee',     jsonb_build_object('id', e.id, 'name', e.name, 'erp_id', e.erp_id),
    'approver',     jsonb_build_object('id', a.id, 'name', a.name, 'erp_id', a.erp_id),
    'organization', jsonb_build_object('id', o.id, 'name', o.name, 'vat_number', o."VAT_number", 'erp_id', o.erp_id),
    'total', coalesce(sum(l.amount), 0),
    'lines', coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'erp_id', l.erp_id, 'title', l.title, 'date', l.date, 'amount', l.amount, 'tax_rate', l.tax,
        'net', round(l.amount / (1 + l.tax / 100), 2), 'tax_amount', l.amount - round(l.amount / (1 + l.tax / 100), 2),
        'category', c.name, 'account_code', c.account_code, 'payment_type', p.name, 'payment_code', p.erp_code,
        'attachment_path', l.foto_path) order by l.id) filter (where l.id is not null), '[]'::jsonb))
  from public."Expense_sheet" s
  left join public."Sheet_status" st on st.id = s.id_status
  left join public.employees e on e.id = s.id_user
  left join public.employees a on a.id = s.reviewed_by
  left join public."Organization" o on o.id = e.id_organization
  left join public."Expense_line" l on l.id_sheet = s.id
  left join public."Expense_category" c on c.id = l.id_category
  left join public."Expense_payment_type" p on p.id = l.id_payment_type
  where s.id = p_id
  group by s.id, st.name, e.id, a.id, o.id
$$;
revoke all on function public.sheet_export(bigint) from public, anon, authenticated;
grant execute on function public.sheet_export(bigint) to service_role;

create or replace function public.expense_sheet_outbox() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.id_status = 2 and old.id_status is distinct from 2 then
    insert into public.erp_outbox (entity, entity_id, event, payload)
    values ('expense_sheet', new.id::text, 'sheet.approved', public.sheet_export(new.id));
  end if;
  return null;
end $$;
revoke all on function public.expense_sheet_outbox() from public, anon, authenticated;
drop trigger if exists expense_sheet_outbox on public."Expense_sheet";
create trigger expense_sheet_outbox after update of id_status on public."Expense_sheet" for each row execute function public.expense_sheet_outbox();

-- ============================================================ guardas de hoja (revisor y motivo)
create or replace function public.expense_sheet_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  is_owner boolean;
  is_approver boolean;
begin
  if auth.role() is distinct from 'authenticated' then
    return new;
  end if;

  is_owner := old.id_user = public.my_employee_id();
  is_approver := public.can_manage(old.id_user);

  if new.id_user is distinct from old.id_user then
    raise exception 'No se puede cambiar el propietario de una hoja' using errcode = '42501';
  end if;
  if new.create_date is distinct from old.create_date then
    raise exception 'No se puede cambiar la fecha de creacion' using errcode = '42501';
  end if;
  if new.erp_id is distinct from old.erp_id then
    raise exception 'El identificador del ERP lo gestiona el sistema' using errcode = '42501';
  end if;

  if new.id_status is distinct from old.id_status then
    if is_approver and old.id_status = 1 and new.id_status in (2, 3) then
      new.approval_date := case when new.id_status = 2 then now() else null end;
      new.reviewed_by := public.my_employee_id();
      new.reviewed_at := now();
      new.review_note := nullif(btrim(coalesce(new.review_note, '')), '');
    elsif is_owner and old.id_status = 3 and new.id_status = 1 then
      new.approval_date := null;
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.review_note := null;
    else
      raise exception 'Transicion de estado no permitida (% -> %)', old.id_status, new.id_status using errcode = '42501';
    end if;
    if (new.title, new.description, new.project, new.currency, new.cost_center)
         is distinct from (old.title, old.description, old.project, old.currency, old.cost_center) then
      raise exception 'No se puede editar la hoja al cambiar su estado' using errcode = '42501';
    end if;
  else
    if new.approval_date is distinct from old.approval_date
       or new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at
       or new.review_note is distinct from old.review_note then
      raise exception 'La revision de una hoja solo se registra al aprobarla o rechazarla' using errcode = '42501';
    end if;
    if (new.title, new.description, new.project, new.currency, new.cost_center)
         is distinct from (old.title, old.description, old.project, old.currency, old.cost_center)
       and not (is_owner and old.id_status = 1) then
      raise exception 'Solo el propietario puede editar una hoja pendiente' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create or replace function public.expense_sheet_new() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.role() is not distinct from 'authenticated' then
    new.approval_date := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.review_note := null;
    new.erp_id := null;
  end if;
  return new;
end $$;

-- ============================================================ 4. codigos de invitacion
alter table public."Organization" add column if not exists invite_code text;
update public."Organization" set invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)) where invite_code is null;
alter table public."Organization"
  alter column invite_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  alter column invite_code set not null;
create unique index if not exists organization_invite_code_key on public."Organization" (invite_code);

create or replace function public.my_org_id() returns bigint
language sql stable security definer set search_path = '' as $$
  select e.id_organization from public.employees e where e.id_user = auth.uid() limit 1
$$;

-- Paso 1 del alta: comprobar el codigo (devuelve solo el nombre de la organizacion)
create or replace function public.organization_by_code(p_code text) returns table (id bigint, name text)
language sql stable security definer set search_path = '' as $$
  select o.id, o.name from public."Organization" o
  where auth.uid() is not null and o.invite_code = upper(btrim(p_code))
$$;

-- Paso 2 del alta: crea la ficha de empleado (nunca administrador) en la organizacion del codigo
create or replace function public.join_organization(p_code text, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org bigint;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesion' using errcode = '28000';
  end if;
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'Introduce tu nombre' using errcode = '22023';
  end if;
  select o.id into v_org from public."Organization" o where o.invite_code = upper(btrim(coalesce(p_code, '')));
  if v_org is null then
    raise exception 'Codigo de empresa no valido' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.employees e where e.id_user = auth.uid()) then
    raise exception 'Ya tienes un perfil' using errcode = '23505';
  end if;
  insert into public.employees (name, is_admin, id_organization, id_user)
  values (btrim(p_name), false, v_org, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Los administradores consultan el codigo de su organizacion para invitar a su gente
create or replace function public.my_invite_code() returns text
language sql stable security definer set search_path = '' as $$
  select o.invite_code from public.employees e join public."Organization" o on o.id = e.id_organization
  where e.id_user = auth.uid() and coalesce(e.is_admin, false)
$$;

revoke all on function public.my_org_id(), public.organization_by_code(text), public.join_organization(text, text), public.my_invite_code() from public, anon;
grant execute on function public.my_org_id(), public.organization_by_code(text), public.join_organization(text, text), public.my_invite_code() to authenticated, service_role;

-- la ruta antigua de alta (INSERT directo) sigue funcionando hasta la migracion 3B, pero sin ids externos
drop policy if exists emp_insert on public.employees;
create policy emp_insert on public.employees for insert to authenticated
  with check (id_user = auth.uid() and coalesce(is_admin, false) = false and id_admin is null and erp_id is null);

-- ============================================================ 5. adjuntos: ruta + politicas por hoja
update public."Expense_line"
   set foto_path = pg_temp.urldecode(regexp_replace(foto, '^.*/storage/v1/object/public/tickets/', ''))
 where foto like '%/storage/v1/object/public/tickets/%' and foto_path is null;

-- Politicas NUEVAS (las antiguas, publicas, se retiran en 3B): el objeto expense-lines/<id_hoja>/<fichero> sigue la visibilidad de la hoja
create policy tickets_select_by_sheet on storage.objects for select to authenticated
  using (bucket_id = 'tickets' and (storage.foldername(name))[1] = 'expense-lines'
         and exists (select 1 from public."Expense_sheet" s where s.id::text = (storage.foldername(name))[2]));
create policy tickets_insert_owner_pending on storage.objects for insert to authenticated
  with check (bucket_id = 'tickets' and (storage.foldername(name))[1] = 'expense-lines'
         and exists (select 1 from public."Expense_sheet" s where s.id::text = (storage.foldername(name))[2]
                     and s.id_user = public.my_employee_id() and s.id_status = 1));
create policy tickets_update_owner_pending on storage.objects for update to authenticated
  using (bucket_id = 'tickets' and (storage.foldername(name))[1] = 'expense-lines'
         and exists (select 1 from public."Expense_sheet" s where s.id::text = (storage.foldername(name))[2]
                     and s.id_user = public.my_employee_id() and s.id_status = 1))
  with check (bucket_id = 'tickets' and (storage.foldername(name))[1] = 'expense-lines'
         and exists (select 1 from public."Expense_sheet" s where s.id::text = (storage.foldername(name))[2]
                     and s.id_user = public.my_employee_id() and s.id_status = 1));
create policy tickets_delete_owner_pending on storage.objects for delete to authenticated
  using (bucket_id = 'tickets' and (storage.foldername(name))[1] = 'expense-lines'
         and exists (select 1 from public."Expense_sheet" s where s.id::text = (storage.foldername(name))[2]
                     and s.id_user = public.my_employee_id() and s.id_status = 1));

-- ============================================================ vistas (numeric, mas columnas al final, security_invoker)
create view public.expense_sheet_with_total with (security_invoker = true) as
  select s.id, s.title, s.description, s.project, s.create_date, s.approval_date, s.id_user, s.id_status,
         coalesce(sum(l.amount), 0) as total_amount,
         json_build_object('id', st.id, 'name', st.name) as status,
         s.reference, s.review_note, s.reviewed_at, s.reviewed_by, s.currency, s.updated_at
  from public."Expense_sheet" s
  left join public."Expense_line" l on l.id_sheet = s.id
  left join public."Sheet_status" st on st.id = s.id_status
  group by s.id, st.id;

create view public.expense_dashboard_stats with (security_invoker = true) as
  select e.id as id_user, e.name, e.id_admin,
         count(distinct s.id) as total_expense_sheets,
         count(distinct s.id) filter (where s.id_status = 2) as approved_sheets,
         count(distinct s.id) filter (where s.id_status = 1) as pending_sheets,
         count(distinct s.id) filter (where s.id_status = 3) as denied_sheets,
         count(l.id) as total_expense_lines,
         coalesce(sum(l.amount), 0) as total_amount
  from public.employees e
  left join public."Expense_sheet" s on s.id_user = e.id
  left join public."Expense_line" l on l.id_sheet = s.id
  group by e.id, e.name, e.id_admin;

revoke all on public.expense_sheet_with_total, public.expense_dashboard_stats from anon, authenticated;
grant select on public.expense_sheet_with_total, public.expense_dashboard_stats to authenticated;

create view views.expense_sheet_with_total with (security_invoker = true) as
  select s.id, s.title, s.description, s.project, s.create_date, s.approval_date, s.id_user, s.id_status,
         coalesce(sum(l.amount), 0) as total_amount,
         st.id as status_id, st.name as status_name
  from public."Expense_sheet" s
  left join public."Expense_line" l on l.id_sheet = s.id
  left join public."Sheet_status" st on st.id = s.id_status
  group by s.id, st.id;
