-- Fase 5 — Pedido y Presupuesto
-- service_requests + quotes + quote_items + quote_acceptance_tokens + RLS
-- + permisos del flujo.

-- ═══════════════════════════════════════════════════════════════
-- Tablas
-- ═══════════════════════════════════════════════════════════════

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  equipment_id uuid references public.equipment(id) on delete set null,
  origin text not null default 'llamada'
    check (origin in ('llamada', 'whatsapp', 'qr_publico', 'presencial')),
  description text,
  status text not null default 'recibido'
    check (status in ('recibido', 'presupuestado', 'agendado', 'en_curso', 'resuelto', 'cancelado')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  service_request_id uuid references public.service_requests(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete cascade,
  equipment_id uuid references public.equipment(id) on delete set null,
  labor_amount numeric(15,2) not null default 0,
  discount numeric(15,2) not null default 0,
  subtotal numeric(15,2) not null default 0,
  total numeric(15,2) not null default 0,
  payment_terms text,
  valid_until date,
  status text not null default 'draft'
    check (status in ('draft', 'enviado', 'aceptado', 'rechazado', 'vencido')),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  description text not null,
  type text not null check (type in ('mano_obra', 'material', 'repuesto')),
  quantity numeric(10,2) not null default 1,
  unit_price numeric(15,2) not null default 0,
  subtotal numeric(15,2) not null default 0
);

create table public.quote_acceptance_tokens (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references public.quotes(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null
);

-- Helper para las políticas de las tablas hijas (resuelve la empresa del quote).
create or replace function public.quote_company_id(p_quote_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select company_id from quotes where id = p_quote_id;
$$;

create index service_requests_company_idx on public.service_requests(company_id, created_at);
create index service_requests_client_idx on public.service_requests(client_id);
create index quotes_company_idx on public.quotes(company_id, created_at);
create index quotes_client_idx on public.quotes(client_id);
create index quote_items_quote_idx on public.quote_items(quote_id);
create index quote_acceptance_tokens_token_idx on public.quote_acceptance_tokens(token);

-- ═══════════════════════════════════════════════════════════════
-- RLS — solo aislamiento. Escrituras vía Server Actions (admin client).
-- ═══════════════════════════════════════════════════════════════

alter table public.service_requests enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.quote_acceptance_tokens enable row level security;

create policy "service_requests_select_company" on public.service_requests
  for select using (public.is_superuser() or public.is_company_member(company_id));

create policy "quotes_select_company" on public.quotes
  for select using (public.is_superuser() or public.is_company_member(company_id));

create policy "quote_items_select_company" on public.quote_items
  for select using (
    public.is_superuser()
    or public.is_company_member(public.quote_company_id(quote_id))
  );

create policy "quote_acceptance_tokens_select_company" on public.quote_acceptance_tokens
  for select using (
    public.is_superuser()
    or public.is_company_member(public.quote_company_id(quote_id))
  );

-- ═══════════════════════════════════════════════════════════════
-- Permisos del flujo
-- ═══════════════════════════════════════════════════════════════

insert into public.permissions (key, label, category) values
  ('service_requests.create', 'Crear pedidos', 'pedidos'),
  ('service_requests.view', 'Ver pedidos', 'pedidos'),
  ('service_requests.update', 'Actualizar pedidos', 'pedidos'),
  ('quotes.create', 'Crear presupuestos', 'presupuestos'),
  ('quotes.view', 'Ver presupuestos', 'presupuestos'),
  ('quotes.update', 'Editar presupuestos', 'presupuestos'),
  ('quotes.delete', 'Eliminar presupuestos', 'presupuestos'),
  ('quotes.send', 'Enviar presupuestos', 'presupuestos')
on conflict (key) do nothing;

-- Recrea seed_default_role_permissions con los defaults del flujo.
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
    (p_company_id, 'admin', 'service_requests.update', true)
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
