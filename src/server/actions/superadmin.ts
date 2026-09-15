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