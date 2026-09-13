-- Fase 9 (fix) — post-auditoría.
-- 1. payment_applications: validar ambos lados (payment + charge) y su igualdad.
-- 2. Trigger que impide filas cross-empresa (defensa contra bugs del admin client).
-- 3. late_fee_amount >= 0.

create or replace function public.charge_company_id(p_charge_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select company_id from account_charges where id = p_charge_id;
$$;

drop policy if exists "payment_applications_select_company" on public.payment_applications;

create policy "payment_applications_select_company" on public.payment_applications
  for select using (
    public.is_superuser() or (
      public.is_company_member(public.payment_company_id(payment_id))
      and public.is_company_member(public.charge_company_id(charge_id))
      and public.payment_company_id(payment_id) = public.charge_company_id(charge_id)
    )
  );

create or replace function public.check_payment_application_same_company()
returns trigger
language plpgsql
as $$
declare
  v_payment_company uuid;
  v_charge_company uuid;
begin
  select company_id into v_payment_company from payments where id = NEW.payment_id;
  select company_id into v_charge_company from account_charges where id = NEW.charge_id;
  if v_payment_company is distinct from v_charge_company then
    raise exception 'payment and charge must belong to the same company';
  end if;
  return NEW;
end;
$$;

drop trigger if exists payment_applications_same_company on public.payment_applications;

create trigger payment_applications_same_company
  before insert or update on public.payment_applications
  for each row execute function public.check_payment_application_same_company();

alter table public.account_charges
  add constraint account_charges_late_fee_amount_nonnegative
  check (late_fee_amount >= 0);
