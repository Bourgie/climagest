import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Cliente con la service_role key — SOLO servidor.
 * Se usa para operaciones administrativas que no pasan por RLS
 * (crear usuarios vía admin API, alta de empresas, reseteo de credenciales).
 * Nunca exponer este cliente (ni su key) al browser.
 */
export function createAdminClient() {
  return createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
