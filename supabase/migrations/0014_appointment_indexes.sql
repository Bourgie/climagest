-- Fase 6 (fix) — índices para las FKs con ON DELETE SET NULL.
create index appointments_equipment_idx on public.appointments(equipment_id);
create index appointments_service_request_idx on public.appointments(service_request_id);
