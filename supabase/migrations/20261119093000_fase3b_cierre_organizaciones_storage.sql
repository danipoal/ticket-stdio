-- Fase 3B (cierre). Solo se aplica cuando la web nueva (alta por codigo de invitacion, fotos con URL firmada) ya esta desplegada.
--  1. Organization: cada usuario solo lee la suya y sin el codigo de invitacion (que solo ve un administrador por RPC)
--  2. El alta de empleados pasa a ser SOLO por public.join_organization (ya no hay INSERT directo)
--  3. Bucket de tickets privado: lectura/escritura segun la visibilidad de la hoja (politicas de la 3A) y URLs firmadas

-- ------------------------------------------------------------ 1. organizaciones
drop policy if exists org_read_temp on public."Organization";
create policy org_read_own on public."Organization" for select to authenticated using (id = public.my_org_id());
revoke select on public."Organization" from authenticated;
-- sin invite_code ni erp_id: la web debe pedir columnas explicitas (select *) deja de valer
grant select (id, created_at, name, "VAT_number", street, city, country) on public."Organization" to authenticated;

-- ------------------------------------------------------------ 2. alta solo por RPC
drop policy if exists emp_insert on public.employees;
revoke insert on public.employees from authenticated;

-- ------------------------------------------------------------ 3. almacenamiento privado
update storage.buckets set public = false where id = 'tickets';
drop policy if exists "Give anon users access to JPG images in folder 1d5g1yf_0" on storage.objects;
drop policy if exists "Give anon users access to JPG images in folder 1d5g1yf_1" on storage.objects;
drop policy if exists "Give anon users access to JPG images in folder 1d5g1yf_2" on storage.objects;
drop policy if exists "Give anon users access to JPG images in folder 1d5g1yf_3" on storage.objects;
drop policy if exists "auth upload tickets" on storage.objects;
drop policy if exists "auth upload tickets expense-lines" on storage.objects;
drop policy if exists "public read tickets" on storage.objects;
