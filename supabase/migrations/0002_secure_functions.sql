-- ═══════════════════════════════════════════════════════════════
-- Fase 1 (hardening) — post-auditoría rls-auditor
-- 1. seed_default_role_permissions era EXECUTE para PUBLIC (incluido anon),
--    o sea una escritura cross-tenant alcanzable vía RPC sin login. Se revoca
--    de PUBLIC y se deja solo para service_role (Server Actions / seed).
-- 2. `with check` explícito en la política de UPDATE de companies (claridad).
--
-- NOTA: las helpers de RLS (is_superuser, current_company_id, current_role,
-- is_company_member) NO se revocan de authenticated/anon: las políticas RLS
-- las invocan en el contexto del rol que ejecuta la query, y revocar EXECUTE
-- rompería la evaluación de las políticas. Son seguras (dependen de auth.uid()).
-- ═══════════════════════════════════════════════════════════════

revoke execute on function public.seed_default_role_permissions(uuid) from public;
grant execute on function public.seed_default_role_permissions(uuid) to service_role;

alter policy "companies_update_superuser" on public.companies
  with check (public.is_superuser());
