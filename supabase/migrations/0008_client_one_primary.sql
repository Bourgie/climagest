-- Fase 3 (fix) — a lo sumo una dirección primaria por cliente.

create unique index client_addresses_one_primary_idx
  on public.client_addresses(client_id)
  where is_primary;
