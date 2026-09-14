"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/server/auth";

type LogLevel = "error" | "warn" | "info" | "debug";

type ErrorLogInput = {
  level: LogLevel;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  route?: string;
  method?: string;
};

export async function logError(input: ErrorLogInput): Promise<void> {
  try {
    const user = await getCurrentUser();
    const admin = createAdminClient();

    await admin.from("error_logs").insert({
      company_id: user?.companyId ?? null,
      user_id: user?.id ?? null,
      level: input.level,
      message: input.message,
      stack: input.stack ?? null,
      context: input.context ?? null,
      route: input.route ?? null,
      method: input.method ?? null,
    });
  } catch {
    // Silencioso: no romper el flujo principal si falla el logging
    console.error("[logError] failed to persist:", input.message);
  }
}

export async function logRequest(input: {
  method: string;
  path: string;
  statusCode?: number;
  durationMs?: number;
  sampled?: boolean;
}): Promise<void> {
  try {
    const user = await getCurrentUser();
    const admin = createAdminClient();

    await admin.from("request_logs").insert({
      company_id: user?.companyId ?? null,
      user_id: user?.id ?? null,
      method: input.method,
      path: input.path,
      status_code: input.statusCode ?? null,
      duration_ms: input.durationMs ?? null,
      sampled: input.sampled ?? false,
    });
  } catch {
    console.error("[logRequest] failed to persist");
  }
}

export async function logPowerSync(input: {
  companyId: string;
  userId: string;
  event: "connect" | "sync_start" | "sync_complete" | "sync_error" | "upload" | "download";
  details?: Record<string, unknown>;
  durationMs?: number;
}): Promise<void> {
  try {
    const admin = createAdminClient();

    await admin.from("powersync_sync_logs").insert({
      company_id: input.companyId,
      user_id: input.userId,
      event: input.event,
      details: input.details ?? null,
      duration_ms: input.durationMs ?? null,
    });
  } catch {
    console.error("[logPowerSync] failed to persist:", input.event);
  }
}

// Helper para envolver Server Actions con logging automático de errores
export async function withErrorLogging<T>(
  action: () => Promise<T>,
  context: { route: string; method: string; actionName: string },
): Promise<T> {
  try {
    return await action();
  } catch (e: any) {
    await logError({
      level: "error",
      message: `${context.actionName}: ${e.message}`,
      stack: e.stack,
      route: context.route,
      method: context.method,
      context: { actionName: context.actionName },
    });
    throw e;
  }
}