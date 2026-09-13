-- Fase 6 (fix) — add origin column to appointments
alter table public.appointments
add column if not exists origin text
  check (origin in ('llamada', 'email', 'web', 'qr_publico', 'whatsapp', 'otro'));

create index appointments_origin_idx on public.appointments(origin);