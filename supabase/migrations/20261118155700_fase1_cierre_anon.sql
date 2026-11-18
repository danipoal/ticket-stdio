-- Fase 1 (aplicada el 2026-11-18): cerrar el acceso anonimo a la base de datos.
-- La app siempre inicia sesion antes de leer o escribir, asi que no necesita permisos para `anon`.
begin;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
drop table if exists public.test;
drop function if exists public.create_employee_for_new_user();
commit;
-- Config de Auth cambiada a la vez (no es SQL): external_anonymous_users_enabled=false, site_url=https://ticket.danipoal.com
