-- Fase 3b — Taxes & Currency (puntos 23/24 del plan V1.1)
-- Expande company_settings con configuración fiscal y monetaria completa.
-- V1: importes internos sin cálculo fiscal automático, pero campos listos.

-- ═══════════════════════════════════════════════════════════════
-- Nuevas columnas en company_settings (idempotente)
-- ═══════════════════════════════════════════════════════════════

alter table public.company_settings add column if not exists tax_id text;                    -- CUIT/CUIL
alter table public.company_settings add column if not exists tax_condition text
  check (tax_condition in ('responsable_inscripto', 'monotributo', 'exento', 'consumidor_final'));
alter table public.company_settings add column if not exists default_iva_rate numeric(5,2) not null default 21.00
  check (default_iva_rate >= 0 and default_iva_rate <= 100);
alter table public.company_settings add column if not exists price_display text not null default 'with_tax'
  check (price_display in ('with_tax', 'without_tax', 'both'));
alter table public.company_settings add column if not exists currency text not null default 'ARS'
  check (currency in ('ARS', 'USD'));
alter table public.company_settings add column if not exists decimal_places integer not null default 2
  check (decimal_places >= 0 and decimal_places <= 4);
alter table public.company_settings add column if not exists thousands_separator text not null default '.';
alter table public.company_settings add column if not exists decimal_separator text not null default ',';

-- ═══════════════════════════════════════════════════════════════
-- Actualiza filas existentes con defaults
-- ═══════════════════════════════════════════════════════════════

update public.company_settings set
  tax_condition = coalesce(tax_condition, 'responsable_inscripto'),
  default_iva_rate = coalesce(default_iva_rate, 21.00),
  price_display = coalesce(price_display, 'with_tax'),
  currency = coalesce(currency, 'ARS'),
  decimal_places = coalesce(decimal_places, 2),
  thousands_separator = coalesce(thousands_separator, '.'),
  decimal_separator = coalesce(decimal_separator, ',')
where tax_id is null or tax_condition is null or default_iva_rate is null
   or price_display is null or currency is null or decimal_places is null
   or thousands_separator is null or decimal_separator is null;