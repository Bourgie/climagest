-- Fase 1 (fix) — normalización de company_code.
-- El login normaliza company_code a UPPER para el lookup y a lower para el
-- email sintético. Si la DB permitiera "DEMO" y "demo" como empresas distintas,
-- producirían el mismo internal_email (colisión cross-tenant). Forzamos
-- uppercase a nivel de constraint para que eso sea imposible.

alter table public.companies
  add constraint companies_company_code_uppercase
  check (company_code = upper(company_code));
