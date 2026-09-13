-- Fase 7 (fix) — post-revisión.
-- 1. CHECK de visit_type.
-- 2. Historial del QR: solo work_orders completadas, fecha sin hora.

alter table public.work_orders
  add constraint work_orders_visit_type_check
  check (visit_type in ('instalacion', 'mantenimiento', 'reparacion', 'limpieza', 'otro'));

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
      'date', (coalesce(wo.actual_end_at, wo.created_at))::date
    ) order by coalesce(wo.actual_end_at, wo.created_at) desc
  ), '[]'::jsonb)
  into v_history
  from work_orders wo
  where wo.equipment_id = v_row.id
    and wo.status = 'completado';

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
