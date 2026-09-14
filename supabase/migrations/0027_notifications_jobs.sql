-- Fase 1f — Notificaciones in-app + base de jobs (puntos 18/19/35)
-- notifications con target_role (la matriz vive en el CHECK + comentario)
-- + job_runs para observar los cron (Vercel Cron → endpoint protegido).

-- Matriz de eventos V1 (quién recibe cada tipo):
--   turno_manana          → owner, admin, technician (target_role null = todos)
--   presupuesto_pendiente → owner, admin
--   pago_vencido          → owner, admin
--   consulta_qr           → owner, admin
--   turno_asignado        → technician (recipient puntual)
--   garantia              → owner, admin
--   mantenimiento_proximo → owner, admin (+ technician si se le asigna)
-- La regla se aplica al CREAR la notificación (servicio/cron); RLS la refuerza.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  type text not null check (type in (
    'turno_manana', 'presupuesto_pendiente', 'pago_vencido', 'consulta_qr',
    'turno_asignado', 'garantia', 'mantenimiento_proximo'
  )),
  title text not null,
  body text,
  target_role text check (target_role in ('owner', 'admin', 'technician')),
  recipient_user_id uuid references public.profiles(id) on delete cascade,
  related_table text,
  related_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_company_recipient_idx
  on public.notifications(company_id, recipient_user_id, created_at desc);
create index notifications_company_unread_idx
  on public.notifications(company_id, is_read, created_at desc)
  where is_read = false;

alter table public.notifications enable row level security;
create policy "notifications_select_scoped" on public.notifications
  for select using (
    public.is_superuser()
    or (
      public.is_company_member(company_id)
      and (
        (target_role is null and recipient_user_id is null)
        or target_role = public.current_role()
        or recipient_user_id = auth.uid()
      )
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- job_runs: observabilidad mínima de los cron.
-- Un cron = un endpoint (Vercel Cron) → registra inicio/fin aquí.
-- Evita duplicados: el job marca (job_name, run_key) único por ejecución.
-- ═══════════════════════════════════════════════════════════════

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  job_name text not null,
  run_key text not null,
  status text not null default 'running'
    check (status in ('running', 'ok', 'error')),
  detail jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (job_name, run_key)
);

create index job_runs_job_started_idx on public.job_runs(job_name, started_at desc);

alter table public.job_runs enable row level security;
create policy "job_runs_select_scoped" on public.job_runs
  for select using (
    public.is_superuser()
    or company_id is null
    or public.is_company_member(company_id)
  );
