-- Fase 4 (fix) — post-revisión.
-- 1. Índice redundante (el UNIQUE de qr_token ya crea equipment_qr_token_key).
-- 2. Grant explícito del endpoint público (documenta que debe ser invocable
--    por anon/authenticated; hoy lo cubre PUBLIC, pero lo hacemos explícito).

drop index if exists public.equipment_qr_token_idx;

grant execute on function public.get_equipment_public(text, text)
  to anon, authenticated;
