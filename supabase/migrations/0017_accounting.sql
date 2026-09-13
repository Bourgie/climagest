-- Fase 9 — Cuenta corriente y pagos
-- account_charges + payments + payment_applications + RLS + permisos.
--
-- status de account_charges: {pendiente, parcial, pagado, vencido}. Se mantiene
-- en cada escritura (ver servicios). 'vencido' = saldo pendiente + due_date
-- pasada; la UI también lo deriva en vivo (ver displayStatus en código).

create table public.account_charges (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  related_work_order_id uuid references public.work_orders(id) on delete set null,
  description text not null,
  amount numeric(15,2) not null check (amount > 0),
  due_date date,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'parcial', 'pagado', 'vencido')),
  late_fee_applied boolean not null default false,
  late_fee_amount numeric(15,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  amount numeric(15,2) not null check (amount > 0),
  method text not null
    check (method in ('efectivo', 'transferencia', 'debito', 'credito', 'mercadopago', 'otro')),
  paid_at timestamptz not null default now(),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.payment_applications (
  payment_id uuid not null references public.payments(id) on delete cascade,
  charge_id uuid not null references public.account_charges(id) on delete cascade,
  amount_applied numeric(15,2) not null check (amount_applied > 0),
  primary key (payment_id, charge_id)
);

create or replace function public.payment_company_id(p_payment_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select company_id from payments where id = p_payment_id;
$$;

create index account_charges_company_client_status_idx
  on public.account_charges(company_id, client_id, status);
create index payments_company_client_idx
  on public.payments(company_id, client_id);
create index payment_applications_payment_idx
  on public.payment_applications(payment_id);
create index payment_applications_charge_idx
  on public.payment_applications(charge_id);

alter table public.account_charges enable row level security;
alter table public.payments enable row level security;
alter table public.payment_applications enable row level security;

create policy "account_charges_select_company" on public.account_charges
  for select using (public.is_superuser() or public.is_company_member(company_id));

create policy "payments_select_company" on public.payments
  for select using (public.is_superuser() or public.is_company_member(company_id));

create policy "payment_applications_select_company" on public.payment_applications
  for select using (
    public.is_superuser()
    or public.is_company_member(public.payment_company_id(payment_id))
  );

-- ═══════════════════════════════════════════════════════════════
-- Permisos
-- ═══════════════════════════════════════════════════════════════

insert into public.permissions (key, label, category) values
  ('charges.create', 'Crear cargos', 'cuenta_corriente'),
  ('charges.view', 'Ver cuenta corriente', 'cuenta_corriente'),
  ('charges.update', 'Editar cargos', 'cuenta_corriente'),
  ('charges.delete', 'Eliminar cargos', 'cuenta_corriente')
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
    (p_company_id, 'admin', 'work_orders.delete', false),
    (p_company_id, 'admin', 'charges.create', true),
    (p_company_id, 'admin', 'charges.view', true),
    (p_company_id, 'admin', 'charges.update', true),
    (p_company_id, 'admin', 'charges.delete', false)
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
