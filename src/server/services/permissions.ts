import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "./audit";
import type { ServiceResult } from "./types";

export type RolePermissionEntry = { key: string; allowed: boolean };

/**
 * Actualiza la matriz de permisos de un rol (admin/technician) de la empresa.
 * El Dueño (o quien tenga role_permissions.update) configura; el owner siempre
 * tiene todo y no se edita acá.
 */
export async function updateRolePermissions(args: {
  admin: SupabaseClient;
  companyId: string;
  actorUserId: string;
  canUpdate: boolean;
  role: "admin" | "technician";
  entries: RolePermissionEntry[];
}): Promise<ServiceResult> {
  if (!args.canUpdate) return { ok: false, error: "No autorizado." };
  const { admin, companyId, actorUserId, role, entries } = args;

  if (role !== "admin" && role !== "technician") {
    return { ok: false, error: "Rol inválido." };
  }

  // Validar que las keys existan en el catálogo fijo.
  const { data: catalog } = await admin.from("permissions").select("key");
  const validKeys = new Set((catalog ?? []).map((p) => p.key));
  for (const e of entries) {
    if (!validKeys.has(e.key)) {
      return { ok: false, error: `Permiso desconocido: ${e.key}` };
    }
  }

  for (const e of entries) {
    const { error } = await admin.from("role_permissions").upsert(
      {
        company_id: companyId,
        role,
        permission_key: e.key,
        allowed: e.allowed,
      },
      { onConflict: "company_id,role,permission_key" },
    );
    if (error) return { ok: false, error: "No se pudo guardar la configuración." };
  }

  await writeAuditLog(admin, {
    companyId,
    userId: actorUserId,
    action: "role_permissions.update",
    entityType: "role_permissions",
    newData: { role, entries },
  });

  return { ok: true };
}
