-- Fase 2 (fix) — post-revisión
-- 1. audit_logs.company_id: on delete cascade → on delete set null.
--    La auditoría es append-only; borrar una empresa no debe borrar su historial.
-- 2. Backfill: el Dueño de empresas ya existentes obtiene el permiso nuevo
--    users.reset_password (agregado al catálogo en 0005, después de que
--    seed_default_role_permissions corriera para esas empresas).

alter table public.audit_logs
  drop constraint audit_logs_company_id_fkey;

alter table public.audit_logs
  add constraint audit_logs_company_id_fkey
    foreign key (company_id) references public.companies(id) on delete set null;

insert into public.role_permissions (company_id, role, permission_key, allowed)
select id, 'owner', 'users.reset_password', true
from public.companies
on conflict (company_id, role, permission_key) do nothing;
