-- Fase 3a — Soft delete + integridad histórica (punto 21 del plan V1.1)
-- Agrega deleted_at + deleted_by a entidades core.
-- Índices únicos parciales (WHERE deleted_at IS NULL) evitan duplicados
-- entre vivos; los borrados no compiten.

-- ═══════════════════════════════════════════════════════════════
-- Columnas (idempotente)
-- ═══════════════════════════════════════════════════════════════

alter table public.clients add column if not exists deleted_at timestamptz;
alter table public.clients add column if not exists deleted_by uuid references auth.users(id);

alter table public.equipment add column if not exists deleted_at timestamptz;
alter table public.equipment add column if not exists deleted_by uuid references auth.users(id);

alter table public.service_requests add column if not exists deleted_at timestamptz;
alter table public.service_requests add column if not exists deleted_by uuid references auth.users(id);

alter table public.quotes add column if not exists deleted_at timestamptz;
alter table public.quotes add column if not exists deleted_by uuid references auth.users(id);

alter table public.work_orders add column if not exists deleted_at timestamptz;
alter table public.work_orders add column if not exists deleted_by uuid references auth.users(id);

alter table public.payments add column if not exists deleted_at timestamptz;
alter table public.payments add column if not exists deleted_by uuid references auth.users(id);

alter table public.account_charges add column if not exists deleted_at timestamptz;
alter table public.account_charges add column if not exists deleted_by uuid references auth.users(id);

alter table public.profiles add column if not exists deleted_at timestamptz;
alter table public.profiles add column if not exists deleted_by uuid references auth.users(id);

alter table public.branches add column if not exists deleted_at timestamptz;
alter table public.branches add column if not exists deleted_by uuid references auth.users(id);

alter table public.company_settings add column if not exists deleted_at timestamptz;
alter table public.company_settings add column if not exists deleted_by uuid references auth.users(id);

alter table public.maintenance_plans add column if not exists deleted_at timestamptz;
alter table public.maintenance_plans add column if not exists deleted_by uuid references auth.users(id);

alter table public.fault_types add column if not exists deleted_at timestamptz;
alter table public.fault_types add column if not exists deleted_by uuid references auth.users(id);

-- ═══════════════════════════════════════════════════════════════
-- Índices para consultas "solo vivos" (performance)
-- ═══════════════════════════════════════════════════════════════

create index if not exists clients_company_deleted_idx on public.clients(company_id, deleted_at) where deleted_at is null;
create index if not exists equipment_company_deleted_idx on public.equipment(company_id, deleted_at) where deleted_at is null;
create index if not exists service_requests_company_deleted_idx on public.service_requests(company_id, deleted_at) where deleted_at is null;
create index if not exists quotes_company_deleted_idx on public.quotes(company_id, deleted_at) where deleted_at is null;
create index if not exists work_orders_company_deleted_idx on public.work_orders(company_id, deleted_at) where deleted_at is null;
create index if not exists payments_company_deleted_idx on public.payments(company_id, deleted_at) where deleted_at is null;
create index if not exists account_charges_company_deleted_idx on public.account_charges(company_id, deleted_at) where deleted_at is null;
create index if not exists branches_company_deleted_idx on public.branches(company_id, deleted_at) where deleted_at is null;
create index if not exists maintenance_plans_company_deleted_idx on public.maintenance_plans(company_id, deleted_at) where deleted_at is null;
create index if not exists fault_types_company_deleted_idx on public.fault_types(company_id, deleted_at) where deleted_at is null;

-- ═══════════════════════════════════════════════════════════════
-- Unicidad por empresa solo entre "vivos" (doc_number, nombres, etc.)
-- ═══════════════════════════════════════════════════════════════

-- clients: nombre único por empresa entre vivos
do $$
begin
  if not exists (select 1 from pg_indexes where indexname = 'clients_company_name_unique_alive') then
    create unique index clients_company_name_unique_alive on public.clients(company_id, lower(name)) where deleted_at is null;
  end if;
end $$;

-- branches: nombre único por empresa entre vivos
do $$
begin
  if not exists (select 1 from pg_indexes where indexname = 'branches_company_name_unique_alive') then
    create unique index branches_company_name_unique_alive on public.branches(company_id, lower(name)) where deleted_at is null;
  end if;
end $$;

-- doc_number único por empresa entre vivos (ya existen índices únicos, pero recreamos parciales)
do $$
begin
  -- service_requests
  if not exists (select 1 from pg_indexes where indexname = 'service_requests_company_number_alive') then
    drop index if exists service_requests_company_number_idx;
    create unique index service_requests_company_number_alive on public.service_requests(company_id, doc_number) where deleted_at is null;
  end if;
  -- quotes
  if not exists (select 1 from pg_indexes where indexname = 'quotes_company_number_alive') then
    drop index if exists quotes_company_number_idx;
    create unique index quotes_company_number_alive on public.quotes(company_id, doc_number) where deleted_at is null;
  end if;
  -- work_orders
  if not exists (select 1 from pg_indexes where indexname = 'work_orders_company_number_alive') then
    drop index if exists work_orders_company_number_idx;
    create unique index work_orders_company_number_alive on public.work_orders(company_id, doc_number) where deleted_at is null;
  end if;
  -- payments
  if not exists (select 1 from pg_indexes where indexname = 'payments_company_number_alive') then
    drop index if exists payments_company_number_idx;
    create unique index payments_company_number_alive on public.payments(company_id, doc_number) where deleted_at is null;
  end if;
end $$;