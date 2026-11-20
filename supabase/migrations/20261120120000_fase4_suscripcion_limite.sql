-- Fase 4: suscripcion (Stripe) y limite de tickets gratuitos por empresa.
--
--  * Cada empresa tiene 50 tickets (hojas de gasto) gratis. El contador `tickets_created` SOLO SUBE: borrar una hoja no
--    devuelve el cupo (los borrados cuentan).
--  * Con una suscripcion en estado active / trialing / past_due (gracia mientras Stripe reintenta el cobro) no hay limite.
--  * Pasado el limite sin suscripcion, crear una hoja falla con SQLSTATE PT402 (PostgREST lo devuelve como HTTP 402,
--    mensaje `ticket_limit_reached`).
--  * Los datos de Stripe los escribe solo el servidor (Edge Functions con service_role). La tabla no es accesible
--    desde la web: la app lee el estado con la RPC `billing_status()`.
--  * Precio: 2 EUR/mes por trabajador (empleado de la empresa). La cantidad de la suscripcion en Stripe se ajusta al
--    numero de empleados.

-- ------------------------------------------------------------ 1. tabla
create table if not exists public.organization_billing (
  id_organization        bigint primary key references public."Organization"(id) on delete cascade,
  tickets_created        integer not null default 0 check (tickets_created >= 0),
  free_limit             integer not null default 50 check (free_limit >= 0),
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  status                 text not null default 'none'
    check (status in ('none','incomplete','trialing','active','past_due','unpaid','canceled','incomplete_expired','paused')),
  seats                  integer not null default 0 check (seats >= 0),
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  last_event_at          timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
alter table public.organization_billing enable row level security;   -- sin politicas: solo service_role y funciones definer
revoke all on table public.organization_billing from public, anon, authenticated;
grant all on table public.organization_billing to service_role;

-- cupo ya consumido por las hojas existentes (las borradas antes de esta migracion no se pueden conocer)
insert into public.organization_billing (id_organization, tickets_created)
select o.id, count(s.id)
from public."Organization" o
left join public.employees e on e.id_organization = o.id
left join public."Expense_sheet" s on s.id_user = e.id
group by o.id
on conflict (id_organization) do nothing;

-- ------------------------------------------------------------ 2. reglas
create or replace function public.billing_is_paid(p_status text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_status, 'none') in ('trialing', 'active', 'past_due')
$$;

-- Cada hoja nueva consume un cupo de su empresa (y se rechaza si ya no quedan y no hay suscripcion).
-- SECURITY DEFINER: el usuario no tiene acceso a la tabla. La fila se bloquea (FOR UPDATE) para que dos altas
-- simultaneas no se cuelen por encima del limite.
create or replace function public.expense_sheet_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_org bigint;
  b public.organization_billing;
begin
  select e.id_organization into v_org from public.employees e where e.id = new.id_user;
  if v_org is null then
    return new;
  end if;
  insert into public.organization_billing (id_organization) values (v_org) on conflict (id_organization) do nothing;
  select * into b from public.organization_billing where id_organization = v_org for update;
  -- service_role / SQL directo pueden crear hojas (importaciones, correcciones) pero tambien consumen cupo
  if auth.role() is not distinct from 'authenticated'
     and not public.billing_is_paid(b.status)
     and b.tickets_created >= b.free_limit then
    raise exception 'ticket_limit_reached' using errcode = 'PT402',
      hint = 'La empresa ha agotado sus tickets gratuitos. La administracion debe activar la suscripcion.';
  end if;
  update public.organization_billing set tickets_created = tickets_created + 1, updated_at = now() where id_organization = v_org;
  return new;
end $$;
drop trigger if exists expense_sheet_quota on public."Expense_sheet";
create trigger expense_sheet_quota before insert on public."Expense_sheet"
  for each row execute function public.expense_sheet_quota();

-- ------------------------------------------------------------ 3. estado para la web (todos los miembros de la empresa)
create or replace function public.billing_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_org bigint;
  v_admin boolean;
  b public.organization_billing;
  v_seats integer;
  v_used integer;
  v_limit integer;
  v_paid boolean;
begin
  select e.id_organization, coalesce(e.is_admin, false) into v_org, v_admin
  from public.employees e where e.id_user = auth.uid() limit 1;
  if v_org is null then
    return null;
  end if;
  select * into b from public.organization_billing where id_organization = v_org;
  select count(*) into v_seats from public.employees where id_organization = v_org;
  v_used := coalesce(b.tickets_created, 0);
  v_limit := coalesce(b.free_limit, 50);
  v_paid := public.billing_is_paid(b.status);
  return jsonb_build_object(
    'organization_id', v_org,
    'is_admin', v_admin,
    'used', v_used,
    'free_limit', v_limit,
    'remaining', greatest(v_limit - v_used, 0),
    'paid', v_paid,
    'status', coalesce(b.status, 'none'),
    'can_create', v_paid or v_used < v_limit,
    'seats', v_seats,
    'billed_seats', coalesce(b.seats, 0),
    'price_per_seat_cents', 200,
    'monthly_cents', greatest(v_seats, 1) * 200,
    'current_period_end', b.current_period_end,
    'cancel_at_period_end', coalesce(b.cancel_at_period_end, false)
  );
end $$;

revoke all on function public.billing_is_paid(text), public.expense_sheet_quota(), public.billing_status() from public, anon;
grant execute on function public.billing_is_paid(text) to authenticated, service_role;
grant execute on function public.billing_status() to authenticated, service_role;
