"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission, requireUser } from "@/server/auth";
import {
  createCompanyUser,
  resetUserPassword,
  setUserActive,
  updateCompanyUser,
} from "@/server/services/users";

export type UsersActionState = {
  error?: string;
  success?: boolean;
  provisionalPassword?: string;
};

const createSchema = z.object({
  fullName: z.string().trim().min(1, "Nombre requerido"),
  username: z.string().trim().min(1, "Usuario requerido"),
  role: z.enum(["admin", "technician"]),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

export async function createUser(
  _prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) return { error: "No autorizado." };

  const parsed = createSchema.safeParse({
    fullName: formData.get("fullName"),
    username: formData.get("username"),
    role: formData.get("role"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("company_code")
    .eq("id", user.companyId)
    .maybeSingle();

  const result = await createCompanyUser({
    admin,
    company: { id: user.companyId, code: company?.company_code ?? "" },
    actorUserId: user.id,
    canCreate: await hasPermission(user, "users.create"),
    input: parsed.data,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/config/usuarios");
  return { success: true, provisionalPassword: result.provisionalPassword };
}

export async function changeUserRole(
  _prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) return { error: "No autorizado." };

  const targetUserId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (role !== "admin" && role !== "technician") return { error: "Rol inválido." };

  const admin = createAdminClient();
  const result = await updateCompanyUser({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    canUpdate: await hasPermission(user, "users.update"),
    targetUserId,
    input: { role },
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/config/usuarios");
  return { success: true };
}

export async function toggleUserActive(
  _prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) return { error: "No autorizado." };

  const targetUserId = String(formData.get("userId") ?? "");
  const active = formData.get("active") === "true";

  const admin = createAdminClient();
  const result = await setUserActive({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    canUpdate: await hasPermission(user, "users.update"),
    targetUserId,
    active,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/config/usuarios");
  return { success: true };
}

const resetSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

export async function resetPassword(
  _prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) return { error: "No autorizado." };

  const parsed = resetSchema.safeParse({
    userId: formData.get("userId"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const admin = createAdminClient();
  const result = await resetUserPassword({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    canReset: await hasPermission(user, "users.reset_password"),
    targetUserId: parsed.data.userId,
    newPassword: parsed.data.password,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/config/usuarios");
  return { success: true, provisionalPassword: result.provisionalPassword };
}
