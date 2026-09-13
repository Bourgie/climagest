import type { SupabaseClient } from "@supabase/supabase-js";
import { buildInternalEmail } from "@/lib/internal-email";
import { writeAuditLog } from "./audit";
import type { ServiceResult } from "./types";

export type CreateUserInput = {
  fullName: string;
  username: string;
  role: "admin" | "technician";
  password: string;
};

const USERNAME_RE = /^[a-z0-9._-]+$/;

/**
 * Alta de un usuario de empresa (Admin/Técnico). La ejecuta el Dueño (o un
 * rol con el permiso granular users.create). Usa admin client (service_role)
 * porque no hay política RLS de escritura en profiles/memberships.
 */
export async function createCompanyUser(args: {
  admin: SupabaseClient;
  company: { id: string; code: string };
  actorUserId: string;
  canCreate: boolean;
  input: CreateUserInput;
}): Promise<ServiceResult> {
  const { admin, company, actorUserId, input, canCreate } = args;

  if (!canCreate) {
    return { ok: false, error: "No tenés permiso para crear usuarios." };
  }

  const fullName = input.fullName.trim();
  const username = input.username.trim().toLowerCase();

  if (!fullName) return { ok: false, error: "El nombre es requerido." };
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      error: "Usuario inválido (minúsculas, números, punto, guion o subguion).",
    };
  }
  if (input.role !== "admin" && input.role !== "technician") {
    return { ok: false, error: "Rol inválido." };
  }
  if (input.password.length < 8) {
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const email = buildInternalEmail(username, company.code);

  // Unicidad de username en la empresa: la garantiza el UNIQUE de internal_email
  // (email determinístico = username + company_code).
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("internal_email", email)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "Ese usuario ya existe en la empresa." };
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  });
  if (authError || !authData.user) {
    return { ok: false, error: "No se pudo crear el usuario." };
  }
  const userId = authData.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    full_name: fullName,
    username,
    internal_email: email,
    force_password_change: true,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: "No se pudo crear el perfil." };
  }

  const { error: membershipError } = await admin.from("memberships").insert({
    user_id: userId,
    company_id: company.id,
    role: input.role,
    status: "active",
  });
  if (membershipError) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: "No se pudo asignar la empresa." };
  }

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "users.create",
    entityType: "profiles",
    entityId: userId,
    newData: { username, role: input.role },
  });

  return { ok: true, userId, provisionalPassword: input.password };
}

/** Edita nombre/teléfono/rol de un usuario de la misma empresa (no el Dueño). */
export async function updateCompanyUser(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canUpdate: boolean;
  targetUserId: string;
  input: { fullName?: string; phone?: string; role?: "admin" | "technician" };
}): Promise<ServiceResult> {
  if (!args.canUpdate) return { ok: false, error: "No autorizado." };
  const { admin, company, actorUserId, targetUserId, input } = args;

  const { data: membership } = await admin
    .from("memberships")
    .select("role")
    .eq("user_id", targetUserId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!membership) return { ok: false, error: "Usuario no encontrado." };
  if (membership.role === "owner") {
    return { ok: false, error: "No se puede editar al Dueño." };
  }

  if (input.fullName !== undefined || input.phone !== undefined) {
    const updates: Record<string, unknown> = {};
    if (input.fullName !== undefined) updates.full_name = input.fullName.trim();
    if (input.phone !== undefined) updates.phone = input.phone.trim() || null;
    const { error } = await admin.from("profiles").update(updates).eq("id", targetUserId);
    if (error) return { ok: false, error: "No se pudo actualizar el perfil." };
  }

  if (input.role && input.role !== membership.role) {
    const { error } = await admin
      .from("memberships")
      .update({ role: input.role })
      .eq("user_id", targetUserId)
      .eq("company_id", company.id);
    if (error) return { ok: false, error: "No se pudo actualizar el rol." };
  }

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "users.update",
    entityType: "profiles",
    entityId: targetUserId,
    newData: input,
  });

  return { ok: true };
}

/** Alta/baja de un usuario (membership status active/inactive). No toca al Dueño. */
export async function setUserActive(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canUpdate: boolean;
  targetUserId: string;
  active: boolean;
}): Promise<ServiceResult> {
  if (!args.canUpdate) return { ok: false, error: "No autorizado." };
  const { admin, company, actorUserId, targetUserId, active } = args;

  const { data: membership } = await admin
    .from("memberships")
    .select("role")
    .eq("user_id", targetUserId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!membership) return { ok: false, error: "Usuario no encontrado." };
  if (membership.role === "owner") {
    return { ok: false, error: "No se puede desactivar al Dueño." };
  }

  const { error } = await admin
    .from("memberships")
    .update({ status: active ? "active" : "inactive" })
    .eq("user_id", targetUserId)
    .eq("company_id", company.id);
  if (error) return { ok: false, error: "No se pudo actualizar." };

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: active ? "users.reactivate" : "users.deactivate",
    entityType: "memberships",
    entityId: targetUserId,
  });

  return { ok: true };
}

/** Resetea la contraseña de un usuario de la misma empresa (contraseña provisoria). */
export async function resetUserPassword(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canReset: boolean;
  targetUserId: string;
  newPassword: string;
}): Promise<ServiceResult> {
  if (!args.canReset) return { ok: false, error: "No autorizado." };
  const { admin, company, actorUserId, targetUserId, newPassword } = args;

  if (newPassword.length < 8) {
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const { data: membership } = await admin
    .from("memberships")
    .select("role")
    .eq("user_id", targetUserId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!membership) return { ok: false, error: "Usuario no encontrado." };
  if (membership.role === "owner") {
    // Jerarquía: el Dueño lo resetea el Superusuario (resetOwnerPassword), no
    // un Administrativo/Técnico desde acá.
    return { ok: false, error: "No se puede resetear la contraseña del Dueño." };
  }

  const { error } = await admin.auth.admin.updateUserById(targetUserId, {
    password: newPassword,
  });
  if (error) return { ok: false, error: "No se pudo resetear la contraseña." };

  await admin
    .from("profiles")
    .update({ force_password_change: true })
    .eq("id", targetUserId);

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "users.reset_password",
    entityType: "profiles",
    entityId: targetUserId,
  });

  return { ok: true, provisionalPassword: newPassword };
}
