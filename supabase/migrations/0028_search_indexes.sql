-- Fase 2a — Búsqueda global (punto 8 del plan V1.1)
-- pg_trgm + índices GIN para búsqueda difusa en cliente/teléfono/dirección,
-- equipo (marca/modelo/serie) y documentos por número humano.
-- La seguridad por empresa/permiso se aplica en la capa de aplicación
-- (el servicio siempre filtra por company_id y la página por permiso).

create extension if not exists pg_trgm;

create index if not exists clients_name_trgm_idx
  on public.clients using gin (name gin_trgm_ops);
create index if not exists client_contacts_phone_trgm_idx
  on public.client_contacts using gin (phone gin_trgm_ops);
create index if not exists client_addresses_address_trgm_idx
  on public.client_addresses using gin (address gin_trgm_ops);
create index if not exists equipment_brand_model_serial_trgm_idx
  on public.equipment using gin ((
    coalesce(brand, '') || ' ' || coalesce(model, '') || ' ' || coalesce(serial_number, '')
  ) gin_trgm_ops);
