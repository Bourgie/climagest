-- Fase 1b — MultiEmpresa + Multisucursal
-- branches + branch_users para Aislamiento completo.
-- Importante: un usuario pertenece a UNA sola sucursal.

-- ═══════════════════════════════════════════════════════════════
-- Tablas
-- ═══════════════════════════════════════════════════════════════

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  address text,
  phone text,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, name)  -- una sucursal por empresa por nombre
);

create table public.branch_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  assigned_at timestamptz not null default now()
  -- un usuario pertenece a UNA sola sucursal: unique(user_id)
);

-- ═══════════════════════════════════════════════════════════════
-- Índices
-- ═══════════════════════════════════════════════════════════════

create index branches_company_idx on public.branches(company_id);
create index branch_users_branch_idx on public.branch_users(branch_id);
create index branch_users_user_idx on public.branch_users(user_id);

-- ═══════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════

alter table public.branches enable row level security;
create policy "branches_select_company_member" on public.branches
  for select using (public.is_superuser() or public.is_company_member(company_id));

alter table public.branch_users enable row level security;
create policy "branch_users_select_branch_member" on public.branch_users
  for select using (
    public.is_superuser()
    or exists (
      select 1 from memberships
      where user_id = auth.uid()
        and company_id = (select company_id from branches where id = branch_id)
        and status = 'active'
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- appointments.branch_id ya existe desde 0013 como uuid suelto:
-- aquí solo se agrega la FK real (idempotente, nullable para V1).
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'appointments_branch_id_fkey'
  ) then
    alter table public.appointments
      add constraint appointments_branch_id_fkey
      foreign key (branch_id) references public.branches(id) on delete set null;
  end if;
end $$;
