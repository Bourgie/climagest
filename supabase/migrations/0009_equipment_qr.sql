-- Fase 4 — Equipos y QR
-- equipment + qr_inquiries + qr_access_audit + RPC de vista pública (whitelist)
-- + permisos equipment.* + RLS.

-- ═══════════════════════════════════════════════════════════════
-- Tablas
-- ═══════════════════════════════════════════════════════════════

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  address_id uuid references public.client_addresses(id) on delete set null,
  equipment_type text not null
    check (equipment_type in ('split', 'ventana', 'cassette', 'piso-techo', 'VRV', 'otro')),
  brand text,
  model text,
  serial_number text,
  btu integer,
  power text,
  refrigerant_type text,
  install_date date,
  installer_id uuid references public.profiles(id) on delete set null,
  warranty_until date,
  condition_status text,
  location_label text,
  qr_token text not null unique,
  photos jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table public.qr_inquiries (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  visitor_name text not null,
  visitor_contact text not null,
  message text,
  status text not null default 'nuevo'
    check (status in ('nuevo', 'visto', 'respondido')),
  created_at timestamptz not null default now()
);

create table public.qr_access_audit (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  actor_type text not null check (actor_type in ('anon', 'user')),
  user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('view', 'edit_attempt', 'edit_success', 'login_fail')),
  ip_hash text,
  created_at timestamptz not null default now()
);

-- Helper para las políticas de las tablas hijas (resuelve la empresa del equipo).
create or replace function public.equipment_company_id(p_equipment_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select company_id from equipment where id = p_equipment_id;
$$;

create index equipment_company_client_idx on public.equipment(company_id, client_id);
create index equipment_qr_token_idx on public.equipment(qr_token);
create index qr_inquiries_equipment_idx on public.qr_inquiries(equipment_id, created_at);
create index qr_access_audit_equipment_idx on public.qr_access_audit(equipment_id, created_at);

-- ═══════════════════════════════════════════════════════════════
-- RLS — solo aislamiento. Escrituras vía Server Actions (admin client) o,
-- para qr_access_audit, vía la RPC get_equipment_public (SECURITY DEFINER).
-- ═══════════════════════════════════════════════════════════════

alter table public.equipment enable row level security;
alter table public.qr_inquiries enable row level security;
alter table public.qr_access_audit enable row level security;

create policy "equipment_select_company" on public.equipment
  for select using (public.is_superuser() or public.is_company_member(company_id));

create policy "qr_inquiries_select_company" on public.qr_inquiries
  for select using (
    public.is_superuser()
    or public.is_company_member(public.equipment_company_id(equipment_id))
  );

create policy "qr_access_audit_select_company" on public.qr_access_audit
  for select using (
    public.is_superuser()
    or public.is_company_member(public.equipment_company_id(equipment_id))
  );

-- ═══════════════════════════════════════════════════════════════
-- Permisos equipment.*
-- ═══════════════════════════════════════════════════════════════

insert into public.permissions (key, label, category) values
  ('equipment.create', 'Crear equipos', 'equipos'),
  ('equipment.view', 'Ver equipos', 'equipos'),
  ('equipment.update', 'Editar equipos', 'equipos'),
  ('equipment.delete', 'Eliminar equipos', 'equipos')
on conflict (key) do nothing;

-- Recrea seed_default_role_permissions con los defaults de equipos.
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
    (p_company_id, 'admin', 'users.view', true),
    (p_company_id, 'admin', 'users.create', false),
    (p_company_id, 'admin', 'users.update', false),
    (p_company_id, 'admin', 'users.delete', false),
    (p_company_id, 'admin', 'users.reset_password', false),
    (p_company_id, 'admin', 'role_permissions.update', false),
    (p_company_id, 'admin', 'equipment.create', true),
    (p_company_id, 'admin', 'equipment.view', true),
    (p_company_id, 'admin', 'equipment.update', true),
    (p_company_id, 'admin', 'equipment.delete', false)
  on conflict (company_id, role, permission_key) do nothing;

  insert into public.role_permissions (company_id, role, permission_key, allowed)
  values
    (p_company_id, 'technician', 'clients.view', true),
    (p_company_id, 'technician', 'quotes.view', false),
    (p_company_id, 'technician', 'costs.view', false),
    (p_company_id, 'technician', 'equipment.view', true)
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

-- ═══════════════════════════════════════════════════════════════
-- Vista pública del QR (whitelist explícita).
-- SECURITY DEFINER → corre como postgres (lee equipment + escribe el audit).
-- Solo devuelve: brand, model, equipment_type, install_date, history.
-- NUNCA: precios/costos, contacto del cliente, dirección completa, diagnóstico.
-- El historial (tipo+fecha) se agrega en Fase 7, cuando exista work_orders.
-- Expuesta a PUBLIC a propósito: es el endpoint público del QR. Requiere el
-- qr_token (secreto) para devolver algo; sin token válido devuelve found=false.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.get_equipment_public(p_token text, p_ip_hash text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_row equipment%rowtype;
  v_actor text;
  v_user uuid := auth.uid();
begin
  v_actor := case when v_user is null then 'anon' else 'user' end;

  select * into v_row from equipment where qr_token = p_token;
  if not found then
    return jsonb_build_object('found', false);
  end if;

  insert into qr_access_audit (equipment_id, actor_type, user_id, action, ip_hash)
  values (v_row.id, v_actor, v_user, 'view', p_ip_hash);

  return jsonb_build_object(
    'found', true,
    'brand', v_row.brand,
    'model', v_row.model,
    'equipment_type', v_row.equipment_type,
    'install_date', v_row.install_date,
    'history', '[]'::jsonb
  );
end;
$$;
