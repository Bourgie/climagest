-- Fase 1 (fix) — 0002 solo revocó de PUBLIC, pero Supabase otorga EXECUTE
-- EXPLÍCITO a anon/authenticated/service_role sobre funciones del schema public
-- (vía GRANT ... ON ALL FUNCTIONS / ALTER DEFAULT PRIVILEGES). Por eso
-- seed_default_role_permissions seguía ejecutable por anon (escritura
-- cross-tenant vía RPC). Revocamos explícitamente de anon/authenticated.
-- service_role conserva EXECUTE (lo usan el seed y las Server Actions).

revoke execute on function public.seed_default_role_permissions(uuid)
  from anon, authenticated;
