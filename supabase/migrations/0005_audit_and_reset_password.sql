-- Fase 2 — Administración y permisos
-- 1. Permiso users.reset_password (reset de contraseña por jerarquía).
-- 2. Tabla audit_logs (altas/bajas, reset, cambios de permisos) + RLS.

insert into public.permissions (key, label, category) values
  ('users.reset_password', 'Resetear contraseñas', 'usuarios');

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_company_created_idx
  on public.audit_logs(company_id, created_at);

alter table public.audit_logs enable row level security;

-- Lectura: superusuario (todo) o miembro de la misma empresa. Escrituras vía
-- Server Actions con admin client (service_role), no hay políticas de escritura.
create policy "audit_logs_select_superuser_or_company" on public.audit_logs
  for select using (
    public.is_superuser()
    or (company_id is not null and public.is_company_member(company_id))
  );
