import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditEntry = {
  companyId: string | null;
  userId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
};

/**
 * Escribe una entrada en audit_logs vía admin client (service_role, bypass RLS).
 * Las escrituras de auditoría siempre pasan por Server Actions, nunca por el
 * client del usuario.
 */
export async function writeAuditLog(
  admin: SupabaseClient,
  entry: AuditEntry,
): Promise<void> {
  await admin.from("audit_logs").insert({
    company_id: entry.companyId,
    user_id: entry.userId,
    action: entry.action,
    entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null,
    old_data: entry.oldData ?? null,
    new_data: entry.newData ?? null,
  });
}
