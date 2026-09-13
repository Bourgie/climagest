-- Fase 6 (fix) — add appointment_type column to appointments
alter table public.appointments
add column if not exists appointment_type text not null default 'instalacion'
  check (appointment_type in ('instalacion', 'mantenimiento', 'reparacion', 'limpieza', 'otro'));