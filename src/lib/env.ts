import "server-only";

import { serverEnvSchema, type ServerEnv } from "./env-schema";

/**
 * Carga y valida las variables de entorno del servidor.
 * Falla rápido (al arrancar) con un mensaje claro si falta o es inválida
 * alguna variable, en lugar de explotar con `!` en runtime.
 */
function loadEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse({
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    POWER_SYNC_URL: process.env.NEXT_PUBLIC_POWER_SYNC_URL,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Variables de entorno inválidas o faltantes:\n${issues}`);
  }

  return parsed.data;
}

export const env = loadEnv();
