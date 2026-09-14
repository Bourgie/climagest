-- Fase 1c — Catalogo de tipos de falla y mantenimiento
-- fault_types + maintenance_plans + maintenance_records.
-- Permiten un sistema robusto de alertas de garantía y recordatorios de mantenimiento.

-- ═══════════════════════════════════════════════════════════════
-- Tablas
-- ═══════════════════════════════════════════════════════════════

create table public.fault_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  frequency text not null check (frequency in ('monthly', 'quarterly', 'semi_annual', 'annual', 'custom')),
  next_date date,
  last_performed_at timestamptz,
  type text not null default 'preventivo' check (type in ('preventivo', 'correctivo', 'inspectivo')),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  work_order_id uuid references public.work_orders(id) on delete set null,
  performed_at timestamptz not null default now(),
  performed_by uuid references public.profiles(id) on delete set null,
  fault_type_id uuid references public.fault_types(id),
  notes text,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════
-- Índices
-- ═══════════════════════════════════════════════════════════════

create index fault_types_company_idx on public.fault_types(company_id);
create index maintenance_plans_company_equipment_idx on public.maintenance_plans(company_id, equipment_id);
create index maintenance_plans_next_date_idx on public.maintenance_plans(next_date);
create index maintenance_records_company_idx on public.maintenance_records(company_id);
create index maintenance_records_equipment_idx on public.maintenance_records(equipment_id);

-- ═══════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════

alter table public.fault_types enable row level security;
create policy "fault_types_select_company" on public.fault_types
  for select using (public.is_superuser() or public.is_company_member(company_id));

alter table public.maintenance_plans enable row level security;
create policy "maintenance_plans_select_company" on public.maintenance_plans
  for select using (public.is_superuser() or public.is_company_member(company_id));

alter table public.maintenance_records enable row level security;
create policy "maintenance_records_select_company" on public.maintenance_records
  for select using (public.is_superuser() or public.is_company_member(company_id));
