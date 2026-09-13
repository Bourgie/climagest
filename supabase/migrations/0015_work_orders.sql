-- Fase 7 — Orden de Trabajo
-- work_orders + work_order_materials + work_order_photos + RLS + permisos
-- + historial del QR (get_equipment_public con visit_type + fecha).

create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  service_request_id uuid references public.service_requests(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  visit_type text not null,
  diagnosis_notes text,
  measurements jsonb,
  fault_found text,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  signature_image text,
  status text not null default 'borrador'
    check (status in ('borrador', 'en_progreso', 'completado', 'cancelado')),
  warranty_days integer,
  warranty_until date,
  created_at timestamptz not null default now()
);

create table public.work_order_materials (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_cost numeric(15,2) not null default 0,
  subtotal numeric(15,2) not null default 0
);

create table public.work_order_photos (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  storage_path text not null,
  photo_type text not null
    check (photo_type in ('antes', 'durante', 'despues', 'equipo', 'placa', 'falla', 'terminado'))
);

create or replace function public.work_order_company_id(p_work_order_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select company_id from work_orders where id = p_work_order_id;
$$;

create index work_orders_company_equipment_idx
  on public.work_orders(company_id, equipment_id, created_at);
create index work_orders_equipment_idx on public.work_orders(equipment_id, created_at);
create index work_orders_created_by_idx on public.work_orders(created_by);
create index work_order_materials_wo_idx on public.work_order_materials(work_order_id);
create index work_order_photos_wo_idx on public.work_order_photos(work_order_id);

-- ═══════════════════════════════════════════════════════════════
-- RLS — solo aislamiento. Escrituras vía Server Actions (admin client).
-- ═══════════════════════════════════════════════════════════════

alter table public.work_orders enable row level security;
alter table public.work_order_materials enable row level security;
alter table public.work_order_photos enable row level security;

create policy "work_orders_select_company" on public.work_orders
  for select using (public.is_superuser() or public.is_company_member(company_id));

create policy "work_order_materials_select_company" on public.work_order_materials
  for select using (
    public.is_superuser()
    or public.is_company_member(public.work_order_company_id(work_order_id))
  );

create policy "work_order_photos_select_company" on public.work_order_photos
  for select using (
    public.is_superuser()
    or public.is_company_member(public.work_order_company_id(work_order_id))
  );

-- ═══════════════════════════════════════════════════════════════
-- Permisos
-- ═══════════════════════════════════════════════════════════════

insert into public.permissions (key, label, category) values
  ('work_orders.create', 'Crear órdenes de trabajo', 'ordenes'),
  ('work_orders.view', 'Ver órdenes de trabajo', 'ordenes'),
  ('work_orders.update', 'Editar órdenes de trabajo', 'ordenes'),
  ('work_orders.delete', 'Eliminar órdenes de trabajo', 'ordenes')
on conflict (key) do nothing;

create or replace function public.seed_default_role_permissions(p_company_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.role_permissions (company_id, role, permission_key, allowed)
  select p_company_id, 'owner', key, true from public.permissions
  on conflict (company_id, role, permission_key) do nothing;

  insert into public.role_permissions (company_id, role, permission_key, allowed)
  values
    (p_company_id, 'admin', 'clients.create', true),
    (p_company_id, 'admin', 'clients.view', true),
    (p_company_id, 'admin', 'clients.update', true),
    (p_company_id, 'admin', 'clients.delete', false),
    (p_company_id, 'admin', 'payments.register', true),
    (p_company_id, 'admin', 'payments.delete', false),
    (p_company_id, 'admin', 'costs.view', false),
    (p_company_id, 'admin', 'quotes.create', true),
    (p_company_id, 'admin', 'quotes.view', true),
    (p_company_id, 'admin', 'quotes.update', true),
    (p_company_id, 'admin', 'quotes.delete', false),
    (p_company_id, 'admin', 'quotes.send', true),
    (p_company_id, 'admin', 'users.view', true),
    (p_company_id, 'admin', 'users.create', false),
    (p_company_id, 'admin', 'users.update', false),
    (p_company_id, 'admin', 'users.delete', false),
    (p_company_id, 'admin', 'users.reset_password', false),
    (p_company_id, 'admin', 'role_permissions.update', false),
    (p_company_id, 'admin', 'equipment.create', true),
    (p_company_id, 'admin', 'equipment.view', true),
    (p_company_id, 'admin', 'equipment.update', true),
    (p_company_id, 'admin', 'equipment.delete', false),
    (p_company_id, 'admin', 'service_requests.create', true),
    (p_company_id, 'admin', 'service_requests.view', true),
    (p_company_id, 'admin', 'service_requests.update', true),
    (p_company_id, 'admin', 'appointments.create', true),
    (p_company_id, 'admin', 'appointments.view', true),
    (p_company_id, 'admin', 'appointments.update', true),
    (p_company_id, 'admin', 'appointments.delete', true),
    (p_company_id, 'admin', 'work_orders.create', true),
    (p_company_id, 'admin', 'work_orders.view', true),
    (p_company_id, 'admin', 'work_orders.update', true),
    (p_company_id, 'admin', 'work_orders.delete', false)
  on conflict (company_id, role, permission_key) do nothing;

  insert into public.role_permissions (company_id, role, permission_key, allowed)
  values
    (p_company_id, 'technician', 'clients.view', true),
    (p_company_id, 'technician', 'quotes.view', false),
    (p_company_id, 'technician', 'costs.view', false),
    (p_company_id, 'technician', 'equipment.view', true),
    (p_company_id, 'technician', 'appointments.view', true),
    (p_company_id, 'technician', 'work_orders.create', true),
    (p_company_id, 'technician', 'work_orders.view', true),
    (p_company_id, 'technician', 'work_orders.update', true)
  on conflict (company_id, role, permission_key) do nothing;
end;
$$;

do $$
declare r record;
begin
  for r in select id from public.companies loop
    perform public.seed_default_role_permissions(r.id);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- Historial del QR: get_equipment_public ahora incluye history
-- (solo visit_type + fecha, nunca diagnóstico/costos/mediciones).
-- ═══════════════════════════════════════════════════════════════

create or replace function public.get_equipment_public(p_token text, p_ip_hash text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_row equipment%rowtype;
  v_actor text;
  v_user uuid := auth.uid();
  v_history jsonb;
begin
  v_actor := case when v_user is null then 'anon' else 'user' end;

  select * into v_row from equipment where qr_token = p_token;
  if not found then
    return jsonb_build_object('found', false);
  end if;

  insert into qr_access_audit (equipment_id, actor_type, user_id, action, ip_hash)
  values (v_row.id, v_actor, v_user, 'view', p_ip_hash);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'visit_type', wo.visit_type,
      'date', coalesce(wo.actual_end_at, wo.created_at)
    ) order by coalesce(wo.actual_end_at, wo.created_at) desc
  ), '[]'::jsonb)
  into v_history
  from work_orders wo
  where wo.equipment_id = v_row.id;

  return jsonb_build_object(
    'found', true,
    'brand', v_row.brand,
    'model', v_row.model,
    'equipment_type', v_row.equipment_type,
    'install_date', v_row.install_date,
    'history', v_history
  );
end;
$$;
