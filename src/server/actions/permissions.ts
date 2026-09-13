"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission, requireUser } from "@/server/auth";
import { updateRolePermissions } from "@/server/services/permissions";

export type PermissionsActionState = {
  error?: string;
  success?: boolean;
};

export async function savePermissions(
  _prev: PermissionsActionState,
  formData: FormData,
): Promise<PermissionsActionState> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) return { error: "No autorizado." };

  const role = String(formData.get("role") ?? "");
  if (role !== "admin" && role !== "technician") return { error: "Rol inválido." };

  const admin = createAdminClient();

  // Catálogo fijo de permisos; el form manda un checkbox `perm_<key>` por key.
  const { data: catalog } = await admin.from("permissions").select("key").order("key");
  const entries = (catalog ?? []).map((p) => ({
    key: p.key,
    allowed: formData.get(`perm_${p.key}`) === "on",
  }));

  const result = await updateRolePermissions({
    admin,
    companyId: user.companyId,
    actorUserId: user.id,
    canUpdate: await hasPermission(user, "role_permissions.update"),
    role,
    entries,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/config/permisos");
  return { success: true };
}
