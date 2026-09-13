-- ═══════════════════════════════════════════════════════════════
-- Fase 1 — Plataforma y tenancy
-- companies, company_modules, profiles, memberships, permissions,
-- role_permissions + RLS base (aislamiento multiempresa).
--
-- Roles (valor en memberships.role): 'owner' (Dueño), 'admin' (Administrativo),
-- 'technician' (Técnico). El Superusuario NO es un rol de membership: se marca
-- con profiles.is_superuser = true (nivel plataforma, sin empresa).
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ═══════════════════════════════════════════════════════════════
-- Tablas
-- ═══════════════════════════════════════════════════════════════

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_code text not null unique,
  status text not null default 'trial'
    check (status in ('active', 'suspended', 'blocked', 'trial')),
  plan text not null default 'basico'
    check (plan in ('basico', 'profesional', 'premium')),
  created_at timestamptz not null default now()
);

create table public.company_modules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  module_key text not null,
  enabled boolean not null default false,
  unique (company_id, module_key)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  username text not null,
  phone text,
  internal_email text not null unique,
  force_password_change boolean not null default false,
  is_superuser boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'technician')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  unique (user_id)
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  category text not null
);

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'technician')),
  permission_key text not null references public.permissions(key) on delete cascade,
  allowed boolean not null default false,
  unique (company_id, role, permission_key)
);

-- ═══════════════════════════════════════════════════════════════
-- Helper functions (SECURITY DEFINER → owned by postgres, bypass RLS)
-- Usadas en las políticas para evitar recursión sobre profiles/memberships.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.is_superuser()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and is_superuser = true
  );
$$;

create or replace function public.current_company_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select company_id
  from memberships
  where user_id = auth.uid() and status = 'active'
  limit 1;
$$;

create or replace function public.current_role()
returns text
language sql stable security definer set search_path = public
as $$
  select role
  from memberships
  where user_id = auth.uid() and status = 'active'
  limit 1;
$$;

create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from memberships
    where user_id = auth.uid() and company_id = p_company_id and status = 'active'
  );
$$;

-- ═══════════════════════════════════════════════════════════════
-- Índices
-- ═══════════════════════════════════════════════════════════════

create index memberships_company_id_idx on public.memberships(company_id);
create index profiles_username_idx on public.profiles(username);
create index role_permissions_company_role_idx on public.role_permissions(company_id, role);
create index role_permissions_permission_key_idx on public.role_permissions(permission_key);
create index company_modules_company_idx on public.company_modules(company_id);

-- ═══════════════════════════════════════════════════════════════
-- RLS — solo aislamiento multiempresa.
-- Los permisos granulares de negocio (¿puede eliminar?) NO viven acá:
-- se validan en Server Actions contra role_permissions.
-- Las tablas "sensibles" (companies, company_modules, profiles, memberships,
-- role_permissions) NO tienen políticas de escritura para usuarios finales:
-- sus mutaciones pasan por Server Actions usando el admin client (service_role).
-- ═══════════════════════════════════════════════════════════════

alter table public.companies enable row level security;
alter table public.company_modules enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

-- companies
create policy "companies_select_member_or_superuser" on public.companies
  for select using (public.is_superuser() or public.is_company_member(id));
create policy "companies_insert_superuser" on public.companies
  for insert with check (public.is_superuser());
create policy "companies_update_superuser" on public.companies
  for update using (public.is_superuser());
create policy "companies_delete_superuser" on public.companies
  for delete using (public.is_superuser());

-- company_modules
create policy "company_modules_select_member_or_superuser" on public.company_modules
  for select using (public.is_superuser() or public.is_company_member(company_id));
create policy "company_modules_insert_superuser" on public.company_modules
  for insert with check (public.is_superuser());
create policy "company_modules_update_superuser" on public.company_modules
  for update using (public.is_superuser());
create policy "company_modules_delete_superuser" on public.company_modules
  for delete using (public.is_superuser());

-- profiles: solo lectura (self + superuser). Sin políticas de escritura:
-- el alta y la edición pasan por Server Actions con admin client.
create policy "profiles_select_self_or_superuser" on public.profiles
  for select using (id = auth.uid() or public.is_superuser());

-- memberships: lectura (self + misma empresa + superuser). Escrituras vía
-- Server Action (admin client) con chequeo de rol (Dueño crea usuarios).
create policy "memberships_select_self_company_superuser" on public.memberships
  for select using (
    public.is_superuser()
    or user_id = auth.uid()
    or public.is_company_member(company_id)
  );

-- permissions: catálogo fijo, legible por cualquier usuario autenticado.
create policy "permissions_select_authenticated" on public.permissions
  for select using (auth.uid() is not null);

-- role_permissions: lectura (misma empresa + superuser). Escrituras vía
-- Server Action (admin client) — el Dueño configura desde su pantalla.
create policy "role_permissions_select_company_superuser" on public.role_permissions
  for select using (public.is_superuser() or public.is_company_member(company_id));

-- ═══════════════════════════════════════════════════════════════
-- Catálogo fijo de permisos (parte del código, crece por migración).
-- ═══════════════════════════════════════════════════════════════

insert into public.permissions (key, label, category) values
  ('clients.create',   'Crear clientes',          'clientes'),
  ('clients.view',     'Ver clientes',            'clientes'),
  ('clients.update',   'Editar clientes',         'clientes'),
  ('clients.delete',   'Eliminar clientes',       'clientes'),
  ('payments.register','Registrar pagos',         'pagos'),
  ('payments.delete',  'Eliminar pagos',          'pagos'),
  ('costs.view',       'Ver costos',              'costos'),
  ('quotes.create',    'Crear presupuestos',      'presupuestos'),
  ('quotes.view',      'Ver presupuestos',        'presupuestos'),
  ('users.create',     'Crear usuarios',          'usuarios'),
  ('users.view',       'Ver usuarios',            'usuarios'),
  ('users.update',     'Editar usuarios',         'usuarios'),
  ('users.delete',     'Eliminar usuarios',       'usuarios'),
  ('role_permissions.update', 'Configurar permisos', 'configuracion');

-- ═══════════════════════════════════════════════════════════════
-- Seed de role_permissions por defecto al crear una empresa.
-- Se invoca desde el alta de empresa (Fase 2) y el seed dev.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.seed_default_role_permissions(p_company_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  -- Dueño: todo habilitado
  insert into public.role_permissions (company_id, role, permission_key, allowed)
  select p_company_id, 'owner', key, true from public.permissions
  on conflict (company_id, role, permission_key) do nothing;

  -- Administrativo: valores por defecto razonables
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
    (p_company_id, 'admin', 'role_permissions.update', false)
  on conflict (company_id, role, permission_key) do nothing;

  -- Técnico: set acotado
  insert into public.role_permissions (company_id, role, permission_key, allowed)
  values
    (p_company_id, 'technician', 'clients.view', true),
    (p_company_id, 'technician', 'quotes.view', false),
    (p_company_id, 'technician', 'costs.view', false)
  on conflict (company_id, role, permission_key) do nothing;
end;
$$;
