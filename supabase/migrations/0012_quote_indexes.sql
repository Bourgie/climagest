-- Fase 5 (fix) — post-revisión: índices.
drop index if exists public.quote_acceptance_tokens_token_idx;

create index quotes_service_request_idx on public.quotes(service_request_id);
create index service_requests_equipment_idx on public.service_requests(equipment_id);
create index quotes_equipment_idx on public.quotes(equipment_id);
