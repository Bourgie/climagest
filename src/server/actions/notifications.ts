"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/server/auth";

export async function markNotificationRead(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) return { error: "No autorizado." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "ID requerido." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("company_id", user.companyId);

  if (error) return { error: error.message };

  redirect("/notificaciones");
}