-- Fase 3 — Clientes
-- clients + client_addresses + client_contacts.
-- Un cliente tiene N direcciones y N contactos (no una única dirección).

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.client_addresses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  label text,
  address text not null,
  is_primary boolean not null default false
);

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  role_label text,
  phone text,
  email text
);

-- Helper para las políticas de las tablas hijas (client_addresses/contacts no
-- tienen company_id directo; lo resuelven vía el cliente). SECURITY DEFINER →
-- owned by postgres, bypass RLS (evita recursión sobre clients).
create or replace function public.client_company_id(p_client_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select company_id from clients where id = p_client_id;
$$;

create index clients_company_idx on public.clients(company_id, created_at);
create index client_addresses_client_idx on public.client_addresses(client_id);
create index client_contacts_client_idx on public.client_contacts(client_id);

alter table public.clients enable row level security;
alter table public.client_addresses enable row level security;
alter table public.client_contacts enable row level security;

-- Solo lectura (aislamiento). Escrituras vía Server Actions con admin client:
-- los permisos de negocio (clients.create/update/delete) se validan en la
-- aplicación contra role_permissions, no en RLS.

create policy "clients_select_company" on public.clients
  for select using (public.is_superuser() or public.is_company_member(company_id));

create policy "client_addresses_select_company" on public.client_addresses
  for select using (
    public.is_superuser()
    or public.is_company_member(public.client_company_id(client_id))
  );

create policy "client_contacts_select_company" on public.client_contacts
  for select using (
    public.is_superuser()
    or public.is_company_member(public.client_company_id(client_id))
  );
