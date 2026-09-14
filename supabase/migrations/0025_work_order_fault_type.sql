-- Fase 1d — "Misma falla" estructurada (punto 4 del plan V1.1)
-- work_orders.fault_type_id (FK nullable a fault_types) + seed por empresa.
-- fault_found (texto libre) se mantiene como detalle; fault_type_id es el
-- campo comparable para la alerta "equipo reingresa por la misma falla".

-- 1. Columna (idempotente para re-ejecuciones seguras)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'work_orders'
      and column_name = 'fault_type_id'
  ) then
    alter table public.work_orders
      add column fault_type_id uuid references public.fault_types(id) on delete set null;
  end if;
end $$;

create index if not exists work_orders_equipment_fault_idx
  on public.work_orders(equipment_id, fault_type_id);

-- 2. Unicidad por empresa+nombre (idempotente)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fault_types_company_name_unique'
  ) then
    alter table public.fault_types
      add constraint fault_types_company_name_unique unique (company_id, name);
  end if;
end $$;

-- 3. Seed de tipos de falla comunes por empresa (idempotente por nombre)
create or replace function public.seed_default_fault_types(p_company_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.fault_types (company_id, name, description)
  values
    (p_company_id, 'no enfria', 'El equipo enciende pero no enfría'),
    (p_company_id, 'no enciende', 'El equipo no enciende'),
    (p_company_id, 'pierde agua', 'Pérdida de agua interior/exterior'),
    (p_company_id, 'ruido', 'Ruido anormal interior/exterior'),
    (p_company_id, 'error electronico', 'Código de error en display/placa'),
    (p_company_id, 'baja presion', 'Baja presión de refrigerante'),
    (p_company_id, 'fuga de refrigerante', 'Fuga confirmada de refrigerante'),
    (p_company_id, 'otro', 'Otra falla (detallar en fault_found)')
  on conflict do nothing;
end;
$$;

-- Backfill: solo si la empresa no tiene ningún tipo cargado (no pisa
-- personalizaciones existentes).
do $$
declare r record;
begin
  for r in select id from public.companies loop
    if not exists (select 1 from public.fault_types where company_id = r.id) then
      perform public.seed_default_fault_types(r.id);
    end if;
  end loop;
end $$;
