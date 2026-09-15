-- Fase 3a — Planes configurables (migración)
-- Tabla plans para CRUD desde superadmin, reemplaza MODULE_PRESETS hardcodeado

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  price_monthly numeric(12,2) not null default 0,
  price_yearly numeric(12,2) not null default 0,
  features jsonb not null default '[]',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices
create index plans_active_idx on public.plans(is_active) where is_active = true;

-- RLS
alter table public.plans enable row level security;
create policy "plans_select_superuser_or_company" on public.plans
  for select using (public.is_superuser());

-- Seed de planes por defecto
insert into public.plans (key, name, description, price_monthly, price_yearly, features, is_active, sort_order) values
  ('basico', 'Básico', 'Solo lo esencial para empezar', 0, 0, '["clientes", "agenda"]', true, 1),
  ('profesional', 'Profesional', 'Para equipos en crecimiento', 15000, 150000, '["clientes", "equipos", "agenda", "presupuestos", "ordenes_trabajo", "cuenta_corriente", "dashboard"]', true, 2),
  ('premium', 'Premium', 'Todas las funcionalidades', 30000, 300000, '["clientes", "equipos", "agenda", "presupuestos", "ordenes_trabajo", "cuenta_corriente", "garantias", "dashboard", "reportes", "notificaciones"]', true, 3)
on conflict (key) do nothing;

-- Actualizar company_modules para referenciar plan (opcional, para futura migración)
-- alter table public.company_modules add column plan_id uuid references public.plans(id);