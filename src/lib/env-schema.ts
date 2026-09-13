import { z } from "zod";

/**
 * Esquema de las variables de entorno del servidor.
 * Separado de `env.ts` (que hace el load + fail-fast) para poder testearlo
 * sin depender de `process.env` ni del marcador `server-only`.
 */
export const serverEnvSchema = z.object({
  SUPABASE_URL: z.string().url("SUPABASE_URL debe ser una URL válida"),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY es requerida"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY es requerida"),
  POWER_SYNC_URL: z
    .string()
    .url("POWER_SYNC_URL debe ser una URL válida")
    .optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
