"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MODULES } from "@/lib/modules";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperuser } from "@/server/auth";
import {
  createCompany,
  resetOwnerPassword,
  updateCompanyModules,
  updateCompanyStatus,
  deleteCompany,
  updateCompany,
} from "@/server/services/superadmin";

export type SuperadminActionState = {
  error?: string;
  success?: boolean;
  provisionalPassword?: string;
};

export type SuperadminProfileActionState = {
  error?: string;
  success?: boolean;
};

const createCompanySchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido"),
  companyCode: z.string().trim().min(1, "Código requerido"),
  status: z.string(),
  plan: z.string(),
  ownerFullName: z.string().trim().min(1, "Nombre del Dueño requerido"),
  ownerUsername: z.string().trim().min(1, "Usuario del Dueño requerido"),
  ownerPassword: z.string().min(8, "Contraseña del Dueño: mínimo 8 caracteres"),
});

const updateCompanySchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido"),
  companyCode: z.string().trim().min(1, "Código requerido"),
  status: z.string(),
  plan: z.string(),
});

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Nombre requerido"),
  username: z.string().trim().min(1, "Usuario requerido").regex(/^[a-z0-9_]+$/, "Solo minúsculas, números y guión bajo"),
});

const passwordSchema = z.object({
  current_password: z.string().min(1, "Contraseña actual requerida"),
  new_password: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres"),
  confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Las contraseñas no coinciden.",
  path: ["confirm_password"],
});

// ============================================
// COMPANY ACTIONS
// ============================================

export async function createCompanyAction(
  _prev: SuperadminActionState,
  formData: FormData,
): Promise<SuperadminActionState> {
  const user = await requireSuperuser();

  const parsed = createCompanySchema.safeParse({
    name: formData.get("name"),
    companyCode: formData.get("companyCode"),
    status: formData.get("status"),
    plan: formData.get("plan"),
    ownerFullName: formData.get("ownerFullName"),
    ownerUsername: formData.get("ownerUsername"),
    ownerPassword: formData.get("ownerPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const modules = MODULES.map((m) => m.key).filter(
    (k) => formData.get(`module_${k}`) === "on",
  );

  const admin = createAdminClient();
  const result = await createCompany({
    admin,
    actorUserId: user.id,
    input: {
      name: parsed.data.name,
      companyCode: parsed.data.companyCode,
      status: parsed.data.status,
      plan: parsed.data.plan,
      modules,
      owner: {
        fullName: parsed.data.ownerFullName,
        username: parsed.data.ownerUsername,
        password: parsed.data.ownerPassword,
      },
    },
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/superadmin");
  redirect("/superadmin");
}

export async function updateCompanyAction(
  _prev: SuperadminActionState,
  formData: FormData,
): Promise<SuperadminActionState> {
  const user = await requireSuperuser();

  const companyId = String(formData.get("companyId") ?? "");
  if (!companyId) return { error: "ID de empresa requerido." };

  const parsed = updateCompanySchema.safeParse({
    name: formData.get("name"),
    companyCode: formData.get("companyCode"),
    status: formData.get("status"),
    plan: formData.get("plan"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const admin = createAdminClient();
  const result = await updateCompany({
    admin,
    actorUserId: user.id,
    companyId,
    input: parsed.data,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/superadmin");
  redirect("/superadmin");
}

export async function updateCompanyStatusAction(
  _prev: SuperadminActionState,
  formData: FormData,
): Promise<SuperadminActionState> {
  const user = await requireSuperuser();
  const companyId = String(formData.get("companyId") ?? "");
  const status = String(formData.get("status") ?? "");

  const admin = createAdminClient();
  const result = await updateCompanyStatus({
    admin,
    actorUserId: user.id,
    companyId,
    status,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/superadmin");
  return { success: true };
}

export async function updateCompanyModulesAction(
  _prev: SuperadminActionState,
  formData: FormData,
): Promise<SuperadminActionState> {
  const user = await requireSuperuser();
  const companyId = String(formData.get("companyId") ?? "");
  const modules = MODULES.map((m) => m.key).filter(
    (k) => formData.get(`module_${k}`) === "on",
  );

  const admin = createAdminClient();
  const result = await updateCompanyModules({
    admin,
    actorUserId: user.id,
    companyId,
    modules,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/superadmin");
  return { success: true };
}

export async function resetOwnerPasswordAction(
  _prev: SuperadminActionState,
  formData: FormData,
): Promise<SuperadminActionState> {
  const user = await requireSuperuser();
  const companyId = String(formData.get("companyId") ?? "");
  const newPassword = String(formData.get("password") ?? "");

  const admin = createAdminClient();
  const result = await resetOwnerPassword({
    admin,
    actorUserId: user.id,
    companyId,
    newPassword,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/superadmin");
  return { success: true, provisionalPassword: result.provisionalPassword };
}

export async function deleteCompanyAction(
  _prev: SuperadminActionState,
  formData: FormData,
): Promise<SuperadminActionState> {
  const user = await requireSuperuser();
  const companyId = String(formData.get("companyId") ?? "");
  if (!companyId) return { error: "ID de empresa requerido." };

  const admin = createAdminClient();
  const result = await deleteCompany({
    admin,
    actorUserId: user.id,
    companyId,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/superadmin");
  redirect("/superadmin");
}

// ============================================
// SUPERADMIN PROFILE ACTIONS
// ============================================

export async function updateSuperadminProfileAction(
  _prev: SuperadminProfileActionState,
  formData: FormData,
): Promise<SuperadminProfileActionState> {
  const user = await requireSuperuser();
  if (!user.isSuperuser) return { error: "No autorizado." };

  const userId = String(formData.get("userId") ?? "");
  if (!userId || userId !== user.id) return { error: "ID inválido." };

  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    username: formData.get("username"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("username", parsed.data.username)
    .neq("id", userId)
    .maybeSingle();
  if (existing) return { error: "El usuario ya existe." };

  const { error } = await admin
    .from("profiles")
    .update({ full_name: parsed.data.full_name, username: parsed.data.username })
    .eq("id", userId);

  if (error) return { error: error.message };

  const { data: profile } = await admin.from("profiles").select("internal_email").eq("id", userId).maybeSingle();
  if (profile) {
    const parts = profile.internal_email.split("@");
    if (parts.length === 2) {
      const newEmail = `${parsed.data.username.toLowerCase()}@${parts[1]}`;
      await admin.auth.admin.updateUserById(userId, { email: newEmail });
      await admin.from("profiles").update({ internal_email: newEmail }).eq("id", userId);
    }
  }

  revalidatePath("/superadmin/perfil");
  redirect("/superadmin/perfil");
}

export async function changeSuperadminPasswordAction(
  _prev: SuperadminProfileActionState,
  formData: FormData,
): Promise<SuperadminProfileActionState> {
  const user = await requireSuperuser();
  if (!user.isSuperuser) return { error: "No autorizado." };

  const userId = String(formData.get("userId") ?? "");
  if (!userId || userId !== user.id) return { error: "ID inválido." };

  const currentPassword = String(formData.get("current_password") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Todos los campos son requeridos." };
  }
  if (newPassword.length < 8) {
    return { error: "La nueva contraseña debe tener al menos 8 caracteres." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  const admin = createAdminClient();

  const { data: profile } = await admin.from("profiles").select("internal_email").eq("id", userId).maybeSingle();
  if (!profile) return { error: "Perfil no encontrado." };

  const { data: signIn, error: signInError } = await admin.auth.signInWithPassword({
    email: profile.internal_email,
    password: currentPassword,
  });
  if (signInError || !signIn.user) return { error: "Contraseña actual incorrecta." };

  await admin.auth.admin.signOut(signIn.user.id);

  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return { error: error.message };

  await admin.from("profiles").update({ force_password_change: false }).eq("id", userId);

  redirect("/superadmin/perfil");
}