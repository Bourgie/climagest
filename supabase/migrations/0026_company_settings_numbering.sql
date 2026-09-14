-- Fase 1e — Configuración de empresa + numeración humana (puntos 9/20/23/24/29/30)
-- company_settings (1:1 con companies) + document_counters con función
-- next_document_number() + columnas number en los 4 documentos, con backfill.

-- ═══════════════════════════════════════════════════════════════
-- 1. company_settings (una fila por empresa)
-- ═══════════════════════════════════════════════════════════════

create table public.company_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  currency text not null default 'ARS',
  -- V1: importes internos sin cálculo fiscal. tax_mode documenta la regla:
  -- 'incluido' = precios con IVA incluido, 'no_incluido' = sin discriminar.
  tax_mode text not null default 'incluido'
    check (tax_mode in ('incluido', 'no_incluido', 'exento')),
  default_warranty_days integer not null default 90 check (default_warranty_days >= 0),
  logo_url text,
  phone text,
  whatsapp text,
  email text,
  address text,
  quote_terms text,
  quote_payment_info text,
  updated_at timestamptz not null default now()
);

alter table public.company_settings enable row level security;
create policy "company_settings_select_company" on public.company_settings
  for select using (public.is_superuser() or public.is_company_member(company_id));

-- Una fila por empresa existente (defaults; el Dueño la edita desde su pantalla)
insert into public.company_settings (company_id)
select id from public.companies
on conflict (company_id) do nothing;

-- ═══════════════════════════════════════════════════════════════
-- 2. Contadores por empresa y tipo de documento
-- ═══════════════════════════════════════════════════════════════

create table public.document_counters (
  company_id uuid not null references public.companies(id) on delete cascade,
  doc_type text not null
    check (doc_type in ('service_request', 'quote', 'work_order', 'payment')),
  last_number integer not null default 0,
  primary key (company_id, doc_type)
);

alter table public.document_counters enable row level security;
create policy "document_counters_select_company" on public.document_counters
  for select using (public.is_superuser() or public.is_company_member(company_id));

-- Siguiente número con lock de fila (seguro ante concurrencia).
-- La llama el servicio al crear cada documento (admin client).
create or replace function public.next_document_number(p_company_id uuid, p_doc_type text)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_next integer;
begin
  insert into public.document_counters (company_id, doc_type, last_number)
  values (p_company_id, p_doc_type, 1)
  on conflict (company_id, doc_type) do update
    set last_number = public.document_counters.last_number + 1
  returning last_number into v_next;
  return v_next;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 3. Columnas de número humano (nullable → se rellenan al crear;
--    backfill ordenado por created_at para lo ya existente)
-- ═══════════════════════════════════════════════════════════════

alter table public.service_requests add column if not exists doc_number integer;
alter table public.quotes add column if not exists doc_number integer;
alter table public.work_orders add column if not exists doc_number integer;
alter table public.payments add column if not exists doc_number integer;

-- Backfill por empresa en orden de creación + sincroniza contadores
do $$
declare r record;
begin
  for r in select id from public.companies loop
    with ranked as (
      select id, row_number() over (order by created_at, id) as n
      from public.service_requests where company_id = r.id and doc_number is null
    )
    update public.service_requests s set doc_number = ranked.n
    from ranked where ranked.id = s.id;

    with ranked as (
      select id, row_number() over (order by created_at, id) as n
      from public.quotes where company_id = r.id and doc_number is null
    )
    update public.quotes q set doc_number = ranked.n
    from ranked where ranked.id = q.id;

    with ranked as (
      select id, row_number() over (order by created_at, id) as n
      from public.work_orders where company_id = r.id and doc_number is null
    )
    update public.work_orders w set doc_number = ranked.n
    from ranked where ranked.id = w.id;

    with ranked as (
      select id, row_number() over (order by created_at, id) as n
      from public.payments where company_id = r.id and doc_number is null
    )
    update public.payments p set doc_number = ranked.n
    from ranked where ranked.id = p.id;

    insert into public.document_counters (company_id, doc_type, last_number)
    values
      (r.id, 'service_request', coalesce((select max(doc_number) from public.service_requests where company_id = r.id), 0)),
      (r.id, 'quote', coalesce((select max(doc_number) from public.quotes where company_id = r.id), 0)),
      (r.id, 'work_order', coalesce((select max(doc_number) from public.work_orders where company_id = r.id), 0)),
      (r.id, 'payment', coalesce((select max(doc_number) from public.payments where company_id = r.id), 0))
    on conflict (company_id, doc_type) do update
      set last_number = greatest(public.document_counters.last_number, excluded.last_number);
  end loop;
end $$;

-- Unicidad por empresa (los NULL históricos ya quedaron rellenados arriba)
create unique index if not exists service_requests_company_number_idx
  on public.service_requests(company_id, doc_number);
create unique index if not exists quotes_company_number_idx
  on public.quotes(company_id, doc_number);
create unique index if not exists work_orders_company_number_idx
  on public.work_orders(company_id, doc_number);
create unique index if not exists payments_company_number_idx
  on public.payments(company_id, doc_number);
