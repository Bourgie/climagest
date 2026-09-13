import { describe, expect, it } from "vitest";

import { serverEnvSchema } from "./env-schema";

const valid = {
  SUPABASE_URL: "https://abc.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_abc",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_xyz",
  POWER_SYNC_URL: "https://abc.powersync.journeyapps.com",
};

describe("serverEnvSchema", () => {
  it("acepta un env completo válido", () => {
    const parsed = serverEnvSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("acepta POWER_SYNC_URL ausente (opcional)", () => {
    const parsed = serverEnvSchema.safeParse({
      SUPABASE_URL: valid.SUPABASE_URL,
      SUPABASE_ANON_KEY: valid.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: valid.SUPABASE_SERVICE_ROLE_KEY,
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza si falta SUPABASE_SERVICE_ROLE_KEY", () => {
    const parsed = serverEnvSchema.safeParse({
      SUPABASE_URL: valid.SUPABASE_URL,
      SUPABASE_ANON_KEY: valid.SUPABASE_ANON_KEY,
      POWER_SYNC_URL: valid.POWER_SYNC_URL,
    });
    expect(parsed.success).toBe(false);
  });

  it("rechaza SUPABASE_URL no válida", () => {
    const parsed = serverEnvSchema.safeParse({
      ...valid,
      SUPABASE_URL: "no-es-una-url",
    });
    expect(parsed.success).toBe(false);
  });
});
