-- Fase 3c — Observabilidad: error_logs + request_logs (punto 35 del plan V1.1)
-- Tablas para tracking de errores de aplicación y requests HTTP.
-- Separadas de audit_logs (que son acciones de usuario intencionales).

-- ═══════════════════════════════════════════════════════════════
-- error_logs: errores no controlados / exceptions
-- ═══════════════════════════════════════════════════════════════

create table public.error_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  level text not null check (level in ('error', 'warn', 'info', 'debug')),
  message text not null,
  stack text,
  context jsonb,
  route text,
  method text,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index error_logs_company_created_idx on public.error_logs(company_id, created_at desc);
create index error_logs_level_created_idx on public.error_logs(level, created_at desc);

alter table public.error_logs enable row level security;
create policy "error_logs_select_company" on public.error_logs
  for select using (public.is_superuser() or public.is_company_member(company_id));

-- ═══════════════════════════════════════════════════════════════
-- request_logs: sampling de requests HTTP (1% default, configurable)
-- ═══════════════════════════════════════════════════════════════

create table public.request_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  method text not null,
  path text not null,
  status_code integer,
  duration_ms integer,
  ip_hash text,
  user_agent text,
  sampled boolean not null default false,
  created_at timestamptz not null default now()
);

create index request_logs_company_created_idx on public.request_logs(company_id, created_at desc);
create index request_logs_status_created_idx on public.request_logs(status_code, created_at desc);

alter table public.request_logs enable row level security;
create policy "request_logs_select_company" on public.request_logs
  for select using (public.is_superuser() or public.is_company_member(company_id));

-- ═══════════════════════════════════════════════════════════════
-- powersync_sync_logs: tracking de sincronización offline
-- ═══════════════════════════════════════════════════════════════

create table public.powersync_sync_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null check (event in ('connect', 'sync_start', 'sync_complete', 'sync_error', 'upload', 'download')),
  details jsonb,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index powersync_sync_logs_company_created_idx on public.powersync_sync_logs(company_id, created_at desc);
create index powersync_sync_logs_user_created_idx on public.powersync_sync_logs(user_id, created_at desc);

alter table public.powersync_sync_logs enable row level security;
create policy "powersync_sync_logs_select_company" on public.powersync_sync_logs
  for select using (public.is_superuser() or public.is_company_member(company_id));