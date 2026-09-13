-- Fase 6 — Agenda
-- appointments + appointment_technicians (N:N, varios técnicos por turno)
-- + RLS + permisos.

-- NOTA: appointments.branch_id es una columna reservada (nullable, sin FK): el
-- plan la menciona pero V1 no define una tabla de sucursales/branches. Queda
-- para uso futuro.

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid,
  client_id uuid not null references public.clients(id) on delete cascade,
  equipment_id uuid references public.equipment(id) on delete set null,
  service_request_id uuid references public.service_requests(id) on delete set null,
  scheduled_at timestamptz not null,
  estimated_duration integer,
  status text not null default 'programado'
    check (status in ('programado', 'confirmado', 'en_curso', 'completado', 'cancelado')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.appointment_technicians (
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  technician_id uuid not null references public.profiles(id) on delete cascade,
  primary key (appointment_id, technician_id)
);

-- Helper para las políticas de la tabla hija.
create or replace function public.appointment_company_id(p_appointment_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select company_id from appointments where id = p_appointment_id;
$$;

create index appointments_company_scheduled_idx
  on public.appointments(company_id, scheduled_at);
create index appointments_client_idx on public.appointments(client_id);
create index appointment_technicians_technician_idx
  on public.appointment_technicians(technician_id);

-- ═══════════════════════════════════════════════════════════════
-- RLS — solo aislamiento. Escrituras vía Server Actions (admin client).
-- El scope "técnico ve solo sus turnos" se aplica en la capa de aplicación
-- (y en las Sync Rules de Fase 8), no en RLS.
-- ═══════════════════════════════════════════════════════════════

alter table public.appointments enable row level security;
alter table public.appointment_technicians enable row level security;

create policy "appointments_select_company" on public.appointments
  for select using (public.is_superuser() or public.is_company_member(company_id));

create policy "appointment_technicians_select_company" on public.appointment_technicians
  for select using (
    public.is_superuser()
    or public.is_company_member(public.appointment_company_id(appointment_id))
  );

-- ═══════════════════════════════════════════════════════════════
-- Permisos
-- ═══════════════════════════════════════════════════════════════

insert into public.permissions (key, label, category) values
  ('appointments.create', 'Crear turnos', 'agenda'),
  ('appointments.view', 'Ver turnos', 'agenda'),
  ('appointments.update', 'Editar turnos', 'agenda'),
  ('appointments.delete', 'Eliminar turnos', 'agenda')
on conflict (key) do nothing;

-- Recrea seed_default_role_permissions con los defaults de agenda.
create or replace function public.seed_default_role_permissions(p_company_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.role_permissions (company_id, role, permission_key, allowed)
  select p_company_id, 'owner', key, true from public.permissions
  on conflict (company_id, role, permission_key) do nothing;

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
    (p_company_id, 'admin', 'appointments.delete', true)
  on conflict (company_id, role, permission_key) do nothing;

  insert into public.role_permissions (company_id, role, permission_key, allowed)
  values
    (p_company_id, 'technician', 'clients.view', true),
    (p_company_id, 'technician', 'quotes.view', false),
    (p_company_id, 'technician', 'costs.view', false),
    (p_company_id, 'technician', 'equipment.view', true),
    (p_company_id, 'technician', 'appointments.view', true)
  on conflict (company_id, role, permission_key) do nothing;
end;
$$;

-- Backfill para empresas existentes.
do $$
declare r record;
begin
  for r in select id from public.companies loop
    perform public.seed_default_role_permissions(r.id);
  end loop;
end $$;
