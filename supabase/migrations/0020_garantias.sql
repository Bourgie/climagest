-- Fase 10 — Garantías
-- 1. Agregar service_request_id a account_charges (FK nullable)
-- 2. Agregar created_by a account_charges
-- 3. Índices para consultas frecuentes
-- 3. Permisos charges.* + backfill

-- ═══════════════════════════════════════════════════════════════
-- 1. Agregar service_request_id a account_charges (FK nullable)
-- ═══════════════════════════════════════════════════════════════

alter table public.account_charges
  add column service_request_id uuid references public.service_requests(id) on delete set null;

-- created_by para auditoría de quién creó el cargo
alter table public.account_charges
  add column created_by uuid references auth.users(id) on delete set null;

-- Índice para consultas por service_request
create index account_charges_service_request_idx on public.account_charges(service_request_id);

-- ═══════════════════════════════════════════════════════════════
-- 2. Permisos charges.*
-- ═══════════════════════════════════════════════════════════════

insert into public.permissions (key, label, category) values
  ('charges.create', 'Crear cargos', 'cuenta_corriente'),
  ('charges.view', 'Ver cargos', 'cuenta_corriente'),
  ('charges.update', 'Editar cargos', 'cuenta_corriente'),
  ('charges.delete', 'Eliminar cargos', 'cuenta_corriente')
on conflict (key) do nothing;

-- Recrear seed_default_role_permissions con los nuevos permisos
create or replace function public.seed_default_role_permissions(p_company_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  -- Owner: todos los permisos
  insert into public.role_permissions (company_id, role, permission_key, allowed)
  select p_company_id, 'owner', key, true from public.permissions
  on conflict (company_id, role, permission_key) do nothing;

  -- Admin: todos los permisos de cuenta_corriente + anteriores
  insert into public.role_permissions (company_id, role, permission_key, allowed)
  values
    (p_company_id, 'admin', 'clients.create', true),
    (p_company_id, 'admin', 'clients.view', true),
    (p_company_id, 'admin', 'clients.update', true),
    (p_company_id, 'admin', 'clients.delete', false),
    (p_company_id, 'admin', 'payments.register', true),
    (p_company_id, 'admin', 'payments.delete', false),
    (p_company_id, 'admin', 'costs.view', false),
    (p_company_id, 'admin', 'quotes.create', true),
    (p_company_id, 'admin', 'quotes.view', true),
    (p_company_id, 'admin', 'quotes.update', true),
    (p_company_id, 'admin', 'quotes.delete', false),
    (p_company_id, 'admin', 'quotes.send', true),
    (p_company_id, 'admin', 'users.view', true),
    (p_company_id, 'admin', 'users.create', false),
    (p_company_id, 'admin', 'users.update', false),
    (p_company_id, 'admin', 'users.delete', false),
    (p_company_id, 'admin', 'users.reset_password', false),
    (p_company_id, 'admin', 'role_permissions.update', false),
    (p_company_id, 'admin', 'equipment.create', true),
    (p_company_id, 'admin', 'equipment.view', true),
    (p_company_id, 'admin', 'equipment.update', true),
    (p_company_id, 'admin', 'equipment.delete', false),
    (p_company_id, 'admin', 'service_requests.create', true),
    (p_company_id, 'admin', 'service_requests.view', true),
    (p_company_id, 'admin', 'service_requests.update', true),
    (p_company_id, 'admin', 'appointments.create', true),
    (p_company_id, 'admin', 'appointments.view', true),
    (p_company_id, 'admin', 'appointments.update', true),
    (p_company_id, 'admin', 'appointments.delete', true),
    (p_company_id, 'admin', 'work_orders.create', true),
    (p_company_id, 'admin', 'work_orders.view', true),
    (p_company_id, 'admin', 'work_orders.update', true),
    (p_company_id, 'admin', 'work_orders.delete', false),
    -- Nuevos permisos Fase 10
    (p_company_id, 'admin', 'charges.create', true),
    (p_company_id, 'admin', 'charges.view', true),
    (p_company_id, 'admin', 'charges.update', true),
    (p_company_id, 'admin', 'charges.delete', false)
  on conflict (company_id, role, permission_key) do nothing;

  insert into public.role_permissions (company_id, role, permission_key, allowed)
  values
    (p_company_id, 'technician', 'clients.view', true),
    (p_company_id, 'technician', 'quotes.view', false),
    (p_company_id, 'technician', 'costs.view', false),
    (p_company_id, 'technician', 'quotes.create', true),
    (p_company_id, 'technician', 'quotes.view', true),
    (p_company_id, 'technician', 'quotes.update', true),
    (p_company_id, 'technician', 'quotes.delete', false),
    (p_company_id, 'technician', 'users.create', false),
    (p_company_id, 'technician', 'users.update', false),
    (p_company_id, 'technician', 'users.delete', false),
    (p_company_id, 'technician', 'users.reset_password', false),
    (p_company_id, 'technician', 'role_permissions.update', false),
    (p_company_id, 'technician', 'equipment.create', true),
    (p_company_id, 'technician', 'equipment.view', true),
    (p_company_id, 'technician', 'equipment.update', true),
    (p_company_id, 'technician', 'equipment.delete', false),
    (p_company_id, 'technician', 'service_requests.create', true),
    (p_company_id, 'technician', 'service_requests.view', true),
    (p_company_id, 'technician', 'service_requests.update', true),
    (p_company_id, 'technician', 'appointments.create', true),
    (p_company_id, 'technician', 'appointments.view', true),
    (p_company_id, 'technician', 'appointments.update', true),
    (p_company_id, 'technician', 'appointments.delete', true),
    (p_company_id, 'technician', 'work_orders.create', true),
    (p_company_id, 'technician', 'work_orders.view', true),
    (p_company_id, 'technician', 'work_orders.update', true),
    -- Nuevos Fase 10
    (p_company_id, 'technician', 'charges.create', true),
    (p_company_id, 'technician', 'charges.view', true),
    (p_company_id, 'technician', 'charges.update', true),
    (p_company_id, 'technician', 'charges.delete', false)
  on conflict (company_id, role, permission_key) do nothing;
end;
$$;

-- Backfill para empresas existentes
do $$
declare r record;
begin
  for r in select id from public.companies loop
    perform public.seed_default_role_permissions(r.id);
  end loop;
end $$;