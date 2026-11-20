-- Simulacro de la fase 4. Se ejecuta DESPUES del texto de la migracion, en la misma peticion (una sola transaccion):
--   python3 - <<'X' ... migracion + este fichero ... X   (ver supabase/README.md, "Como probar una migracion")
-- Termina SIEMPRE con una excepcion que deshace todo; si todas las comprobaciones pasan, el mensaje empieza por DRYRUN_OK.
-- Suplanta a usuarios reales (request.jwt.claims + set local role authenticated), como las fases anteriores.
do $t$
declare
  v_org bigint;
  v_emp uuid; v_emp_user uuid;
  v_adm uuid; v_adm_user uuid;
  v_sheets integer;
  v_used integer;
  v_limit integer;
  v_json jsonb;
  v_new bigint;
  v_state text;
  n integer := 0;
begin
  select o.id into v_org from public."Organization" o
   where exists (select 1 from public.employees e where e.id_organization = o.id and not coalesce(e.is_admin, false) and e.id_user is not null)
     and exists (select 1 from public.employees e where e.id_organization = o.id and coalesce(e.is_admin, false) and e.id_user is not null)
   order by o.id limit 1;
  select id, id_user into v_emp, v_emp_user from public.employees where id_organization = v_org and not coalesce(is_admin, false) and id_user is not null order by created_at limit 1;
  select id, id_user into v_adm, v_adm_user from public.employees where id_organization = v_org and coalesce(is_admin, false) and id_user is not null order by created_at limit 1;

  -- 1. contador inicial = hojas existentes de la empresa
  select count(s.id) into v_sheets from public.employees e join public."Expense_sheet" s on s.id_user = e.id where e.id_organization = v_org;
  select tickets_created, free_limit into v_used, v_limit from public.organization_billing where id_organization = v_org;
  if v_used <> v_sheets then raise exception 'T1: contador % <> hojas %', v_used, v_sheets; end if;
  if v_limit <> 50 then raise exception 'T1: limite % <> 50', v_limit; end if;
  n := n + 1;

  -- 2. estado visible para el empleado y para la administracion
  perform set_config('request.jwt.claims', json_build_object('sub', v_emp_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_json := public.billing_status();
  if (v_json->>'is_admin')::boolean or (v_json->>'used')::int <> v_sheets or not (v_json->>'can_create')::boolean or (v_json->>'price_per_seat_cents')::int <> 200 then
    raise exception 'T2: estado empleado % ', v_json;
  end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_json := public.billing_status();
  if not (v_json->>'is_admin')::boolean or (v_json->>'seats')::int < 2 or (v_json->>'monthly_cents')::int <> (v_json->>'seats')::int * 200 then
    raise exception 'T2: estado admin %', v_json;
  end if;
  reset role;
  n := n + 1;

  -- 3. el usuario NO puede leer ni escribir la tabla (ni siquiera la administracion): solo la RPC
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform 1 from public.organization_billing limit 1;
    raise exception 'T3: la administracion pudo leer organization_billing';
  exception when insufficient_privilege then null; end;
  begin
    update public.organization_billing set tickets_created = 0, status = 'active' where id_organization = v_org;
    raise exception 'T3: la administracion pudo escribir organization_billing';
  exception when insufficient_privilege then null; end;
  reset role;
  n := n + 1;

  -- 4. al llegar al limite, crear una hoja falla con PT402 y el contador no cambia
  update public.organization_billing set tickets_created = free_limit, status = 'none' where id_organization = v_org;
  perform set_config('request.jwt.claims', json_build_object('sub', v_emp_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public."Expense_sheet" (title, project, id_user, id_status) values ('limite', 'P', v_emp, 1);
    raise exception 'T4: se creo una hoja sin cupo';
  exception when sqlstate 'PT402' then null; end;
  if (public.billing_status()->>'can_create')::boolean then raise exception 'T4: can_create deberia ser false'; end if;
  reset role;
  select tickets_created into v_used from public.organization_billing where id_organization = v_org;
  if v_used <> 50 then raise exception 'T4: contador %', v_used; end if;
  n := n + 1;

  -- 5. los borrados cuentan: crear la hoja 50, borrarla, y ya no queda cupo
  update public.organization_billing set tickets_created = free_limit - 1 where id_organization = v_org;
  perform set_config('request.jwt.claims', json_build_object('sub', v_emp_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public."Expense_sheet" (title, project, id_user, id_status) values ('ultima gratis', 'P', v_emp, 1) returning id into v_new;
  delete from public."Expense_sheet" where id = v_new;
  begin
    insert into public."Expense_sheet" (title, project, id_user, id_status) values ('otra', 'P', v_emp, 1);
    raise exception 'T5: borrar la hoja devolvio el cupo';
  exception when sqlstate 'PT402' then null; end;
  reset role;
  select tickets_created into v_used from public.organization_billing where id_organization = v_org;
  if v_used <> 50 then raise exception 'T5: contador tras borrar %', v_used; end if;
  n := n + 1;

  -- 6. con suscripcion (active / trialing / past_due) no hay limite y el contador sigue subiendo; cancelada vuelve a bloquear
  foreach v_state in array array['active', 'trialing', 'past_due'] loop
    update public.organization_billing set status = v_state where id_organization = v_org;
    perform set_config('request.jwt.claims', json_build_object('sub', v_emp_user, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into public."Expense_sheet" (title, project, id_user, id_status) values ('con plan ' || v_state, 'P', v_emp, 1);
    v_json := public.billing_status();
    if not (v_json->>'paid')::boolean or not (v_json->>'can_create')::boolean then raise exception 'T6: % no cuenta como de pago: %', v_state, v_json; end if;
    reset role;
  end loop;
  select tickets_created into v_used from public.organization_billing where id_organization = v_org;
  if v_used <> 53 then raise exception 'T6: contador con plan %', v_used; end if;
  foreach v_state in array array['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', 'none'] loop
    update public.organization_billing set status = v_state where id_organization = v_org;
    perform set_config('request.jwt.claims', json_build_object('sub', v_emp_user, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin
      insert into public."Expense_sheet" (title, project, id_user, id_status) values ('sin plan ' || v_state, 'P', v_emp, 1);
      raise exception 'T6: con estado % se pudo crear una hoja pasado el limite', v_state;
    exception when sqlstate 'PT402' then null; end;
    reset role;
  end loop;
  n := n + 1;

  -- 7. una hoja creada sin contexto de usuario (SQL / service_role) se permite pero consume cupo
  perform set_config('request.jwt.claims', '', true);  -- de nuevo sin usuario (SQL directo)
  update public.organization_billing set status = 'none' where id_organization = v_org;
  select tickets_created into v_used from public.organization_billing where id_organization = v_org;
  insert into public."Expense_sheet" (title, project, id_user, id_status) values ('importacion', 'P', v_emp, 1);
  if (select tickets_created from public.organization_billing where id_organization = v_org) <> v_used + 1 then raise exception 'T7: la importacion no consumio cupo'; end if;
  n := n + 1;

  -- 8. todas las empresas empiezan con 50 gratis
  if exists (select 1 from public.organization_billing where free_limit <> 50) then raise exception 'T8: hay empresas con limite distinto de 50'; end if;
  n := n + 1;

  raise exception 'DRYRUN_OK: % comprobaciones superadas', n;
end $t$;
