-- Fase 2: RLS, flujo de aprobacion y vistas corregidas.
-- Compatible con la web actual salvo el cambio buscado: un empleado ya no aprueba sus propias hojas.
--
-- Identidad: auth.uid() = employees.id_user.  employees.id es la clave que usan Expense_sheet.id_user y employees.id_admin.
-- Regla de aprobacion (public.can_manage):
--   * si el empleado tiene id_admin -> solo ese administrador
--   * si no lo tiene                -> cualquier administrador de su organizacion
--   * administrador sin jefe y sin otro administrador en su organizacion -> se aprueba a si mismo

-- ---------------------------------------------------------------- helpers
create or replace function public.my_employee_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select e.id from public.employees e where e.id_user = auth.uid() limit 1
$$;

create or replace function public.can_manage(emp uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.employees o
    join public.employees me on me.id_user = auth.uid() and coalesce(me.is_admin, false)
    where o.id = emp
      and (
           (o.id_admin is not null and o.id_admin = me.id)
        or (o.id_admin is null and o.id <> me.id and o.id_organization is not null and o.id_organization = me.id_organization)
        or (o.id_admin is null and o.id = me.id and not exists (
              select 1 from public.employees a
              where a.is_admin and a.id_organization is not distinct from me.id_organization and a.id <> me.id))
      )
  )
$$;

revoke all on function public.my_employee_id() from public, anon;
revoke all on function public.can_manage(uuid) from public, anon;
grant execute on function public.my_employee_id() to authenticated, service_role;
grant execute on function public.can_manage(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- datos
-- Un usuario de auth solo puede tener una ficha de empleado; y el id_user ya no tiene valor por defecto aleatorio.
create unique index if not exists employees_id_user_key on public.employees (id_user);
alter table public.employees alter column id_user drop default;

-- ---------------------------------------------------------------- RLS
alter table public."Expense_sheet"        enable row level security;
alter table public."Expense_line"         enable row level security;
alter table public.employees              enable row level security;
alter table public."Organization"         enable row level security;
alter table public."Sheet_status"         enable row level security;
alter table public."Expense_category"     enable row level security;
alter table public."Expense_payment_type" enable row level security;
-- Expense_account ya tenia RLS y ninguna politica: sigue cerrada a los clientes.

drop policy if exists "Authenticated users can delete organizations" on public."Organization";
drop policy if exists "Authenticated users can update organizations" on public."Organization";

-- Tablas de referencia: solo lectura para usuarios con sesion
create policy ref_read on public."Sheet_status"         for select to authenticated using (true);
create policy ref_read on public."Expense_category"     for select to authenticated using (true);
create policy ref_read on public."Expense_payment_type" for select to authenticated using (true);

-- Organization: lectura para usuarios con sesion (TEMPORAL: la app valida el codigo de empresa leyendo por VAT).
-- En la fase 3 se sustituira por un RPC con codigo de invitacion y se cerrara esta politica.
create policy org_read_temp on public."Organization" for select to authenticated using (true);

-- employees
create policy emp_select on public.employees for select to authenticated
  using (id_user = auth.uid() or public.can_manage(id));
create policy emp_insert on public.employees for insert to authenticated
  with check (id_user = auth.uid() and coalesce(is_admin, false) = false and id_admin is null);
create policy emp_update_own on public.employees for update to authenticated
  using (id_user = auth.uid()) with check (id_user = auth.uid());

-- Expense_sheet
create policy sheet_select on public."Expense_sheet" for select to authenticated
  using (id_user = public.my_employee_id() or public.can_manage(id_user));
create policy sheet_insert on public."Expense_sheet" for insert to authenticated
  with check (id_user = public.my_employee_id() and id_status = 1);
create policy sheet_update on public."Expense_sheet" for update to authenticated
  using (id_user = public.my_employee_id() or public.can_manage(id_user))
  with check (id_user = public.my_employee_id() or public.can_manage(id_user));
create policy sheet_delete on public."Expense_sheet" for delete to authenticated
  using (id_user = public.my_employee_id() and id_status in (1, 3));

-- Expense_line: se ve lo que se ve de la hoja; solo el dueño la modifica y solo con la hoja pendiente
create policy line_select on public."Expense_line" for select to authenticated
  using (exists (select 1 from public."Expense_sheet" s where s.id = id_sheet));
create policy line_insert on public."Expense_line" for insert to authenticated
  with check (exists (select 1 from public."Expense_sheet" s where s.id = id_sheet and s.id_user = public.my_employee_id() and s.id_status = 1));
create policy line_update on public."Expense_line" for update to authenticated
  using (exists (select 1 from public."Expense_sheet" s where s.id = id_sheet and s.id_user = public.my_employee_id() and s.id_status = 1))
  with check (exists (select 1 from public."Expense_sheet" s where s.id = id_sheet and s.id_user = public.my_employee_id() and s.id_status = 1));
create policy line_delete on public."Expense_line" for delete to authenticated
  using (exists (select 1 from public."Expense_sheet" s where s.id = id_sheet and s.id_user = public.my_employee_id() and s.id_status = 1));

-- ---------------------------------------------------------------- permisos de tabla (minimo necesario)
revoke all on all tables in schema public from authenticated;
grant select on public."Sheet_status", public."Expense_category", public."Expense_payment_type", public."Organization",
                public.employees, public."Expense_sheet", public."Expense_line",
                public.expense_sheet_with_total, public.expense_dashboard_stats to authenticated;
grant insert, delete on public."Expense_sheet", public."Expense_line" to authenticated;
grant update on public."Expense_sheet", public."Expense_line" to authenticated;
grant insert on public.employees to authenticated;
grant update (name) on public.employees to authenticated;   -- is_admin, id_admin e id_organization no se tocan desde el cliente

-- ---------------------------------------------------------------- transiciones de estado
-- 1 Pendiente, 2 Aprobado, 3 Rechazado.
--   aprobador : 1 -> 2, 1 -> 3
--   dueño     : 3 -> 1 (reenviar tras rechazo); edita contenido solo en estado 1
-- Fuera de un contexto de usuario (SQL editor / service_role) no se aplica.
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

  if new.id_status is distinct from old.id_status then
    if is_approver and old.id_status = 1 and new.id_status in (2, 3) then
      new.approval_date := case when new.id_status = 2 then now() else null end;
    elsif is_owner and old.id_status = 3 and new.id_status = 1 then
      new.approval_date := null;
    else
      raise exception 'Transicion de estado no permitida (% -> %)', old.id_status, new.id_status using errcode = '42501';
    end if;
    -- el cambio de estado no puede ir acompañado de cambios de contenido
    if (new.title, new.description, new.project) is distinct from (old.title, old.description, old.project) then
      raise exception 'No se puede editar la hoja al cambiar su estado' using errcode = '42501';
    end if;
  else
    if new.approval_date is distinct from old.approval_date then
      raise exception 'La fecha de aprobacion la fija el sistema' using errcode = '42501';
    end if;
    if (new.title, new.description, new.project) is distinct from (old.title, old.description, old.project)
       and not (is_owner and old.id_status = 1) then
      raise exception 'Solo el propietario puede editar una hoja pendiente' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists expense_sheet_guard on public."Expense_sheet";
create trigger expense_sheet_guard before update on public."Expense_sheet"
  for each row execute function public.expense_sheet_guard();

-- Una hoja nueva nace siempre pendiente y sin fecha de aprobacion
create or replace function public.expense_sheet_new() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.role() is not distinct from 'authenticated' then
    new.approval_date := null;
  end if;
  return new;
end $$;
drop trigger if exists expense_sheet_new on public."Expense_sheet";
create trigger expense_sheet_new before insert on public."Expense_sheet"
  for each row execute function public.expense_sheet_new();

-- ---------------------------------------------------------------- vistas (con RLS del usuario y estados correctos)
create or replace view public.expense_sheet_with_total with (security_invoker = true) as
  select s.id, s.title, s.description, s.project, s.create_date, s.approval_date, s.id_user, s.id_status,
         coalesce(sum(l.amount), (0)::real) as total_amount,
         json_build_object('id', st.id, 'name', st.name) as status
  from public."Expense_sheet" s
  left join public."Expense_line" l on l.id_sheet = s.id
  left join public."Sheet_status" st on st.id = s.id_status
  group by s.id, st.id;

create or replace view public.expense_dashboard_stats with (security_invoker = true) as
  select e.id as id_user, e.name, e.id_admin,
         count(distinct s.id) as total_expense_sheets,
         count(distinct s.id) filter (where s.id_status = 2) as approved_sheets,   -- antes estaba al reves
         count(distinct s.id) filter (where s.id_status = 1) as pending_sheets,
         count(distinct s.id) filter (where s.id_status = 3) as denied_sheets,
         count(l.id) as total_expense_lines,
         coalesce(sum(l.amount), (0)::real) as total_amount
  from public.employees e
  left join public."Expense_sheet" s on s.id_user = e.id
  left join public."Expense_line" l on l.id_sheet = s.id
  group by e.id, e.name, e.id_admin;

grant select on public.expense_sheet_with_total, public.expense_dashboard_stats to authenticated;
revoke all on public.expense_sheet_with_total, public.expense_dashboard_stats from anon;
