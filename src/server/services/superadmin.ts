import type { SupabaseClient } from "@supabase/supabase-js";
import { buildInternalEmail } from "@/lib/internal-email";
import { MODULES, type ModuleKey } from "@/lib/modules";
import { writeAuditLog } from "./audit";
import type { ServiceResult } from "./types";

const STATUSES = ["active", "suspended", "blocked", "trial"];
const PLANS = ["basico", "profesional", "premium"];

export type CreateCompanyInput = {
  name: string;
  companyCode: string;
  status: string;
  plan: string;
  modules: string[];
  owner: { fullName: string; username: string; password: string };
};

/**
 * Alta de empresa + módulos + primer Dueño. La ejecuta el Superusuario
 * (verificado en el action wrapper). Crea también los role_permissions por
 * defecto vía seed_default_role_permissions.
 */
export async function createCompany(args: {
  admin: SupabaseClient;
  actorUserId: string;
  input: CreateCompanyInput;
}): Promise<ServiceResult> {
  const { admin, actorUserId, input } = args;
  const name = input.name.trim();
  const companyCode = input.companyCode.trim().toUpperCase();
  const username = input.owner.username.trim().toLowerCase();

  if (!name || !companyCode) {
    return { ok: false, error: "Nombre y código de empresa son requeridos." };
  }
  if (!/^[A-Z0-9_-]+$/.test(companyCode)) {
    return { ok: false, error: "Código inválido (mayúsculas, números o guion)." };
  }
  if (!STATUSES.includes(input.status)) return { ok: false, error: "Estado inválido." };
  if (!PLANS.includes(input.plan)) return { ok: false, error: "Plan inválido." };
  if (!username) return { ok: false, error: "El usuario del Dueño es requerido." };
  if (input.owner.password.length < 8) {
    return { ok: false, error: "La contraseña del Dueño debe tener al menos 8 caracteres." };
  }

  const { data: existing } = await admin
    .from("companies")
    .select("id")
    .eq("company_code", companyCode)
    .maybeSingle();
  if (existing) return { ok: false, error: "El código de empresa ya existe." };

  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert({ name, company_code: companyCode, status: input.status, plan: input.plan })
    .select("id")
    .single();
  if (companyError || !company) {
    return { ok: false, error: "No se pudo crear la empresa." };
  }
  const companyId = company.id;

  const validModules = new Set<string>(MODULES.map((m) => m.key));
  const modules = input.modules.filter((m) => validModules.has(m));
  if (modules.length) {
    await admin.from("company_modules").insert(
      modules.map((m) => ({ company_id: companyId, module_key: m, enabled: true })),
    );
  }

  const email = buildInternalEmail(username, companyCode);
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: input.owner.password,
    email_confirm: true,
  });
  if (authError || !authData.user) {
    await admin.from("companies").delete().eq("id", companyId);
    return { ok: false, error: "No se pudo crear el Dueño." };
  }
  const ownerId = authData.user.id;

  await admin.from("profiles").insert({
    id: ownerId,
    full_name: input.owner.fullName.trim(),
    username,
    internal_email: email,
    force_password_change: true,
  });
  await admin.from("memberships").insert({
    user_id: ownerId,
    company_id: companyId,
    role: "owner",
    status: "active",
  });

  await admin.rpc("seed_default_role_permissions", { p_company_id: companyId });

  await writeAuditLog(admin, {
    companyId,
    userId: actorUserId,
    action: "companies.create",
    entityType: "companies",
    entityId: companyId,
    newData: { name, company_code: companyCode, status: input.status, plan: input.plan, modules },
  });

  return { ok: true, userId: ownerId, provisionalPassword: input.owner.password };
}

/** Cambia el estado de una empresa (active/suspended/blocked/trial). */
export async function updateCompanyStatus(args: {
  admin: SupabaseClient;
  actorUserId: string;
  companyId: string;
  status: string;
}): Promise<ServiceResult> {
  if (!STATUSES.includes(args.status)) return { ok: false, error: "Estado inválido." };
  const { data: prev } = await args.admin
    .from("companies")
    .select("status")
    .eq("id", args.companyId)
    .maybeSingle();

  const { error } = await args.admin
    .from("companies")
    .update({ status: args.status })
    .eq("id", args.companyId);
  if (error) return { ok: false, error: "No se pudo actualizar." };

  await writeAuditLog(args.admin, {
    companyId: args.companyId,
    userId: args.actorUserId,
    action: "companies.update_status",
    entityType: "companies",
    entityId: args.companyId,
    oldData: { status: prev?.status },
    newData: { status: args.status },
  });
  return { ok: true };
}

/** Reemplaza el set de módulos activos de una empresa. */
export async function updateCompanyModules(args: {
  admin: SupabaseClient;
  actorUserId: string;
  companyId: string;
  modules: string[];
}): Promise<ServiceResult> {
  const validModules = new Set<string>(MODULES.map((m) => m.key));
  const modules = args.modules.filter((m) => validModules.has(m));

  await args.admin.from("company_modules").delete().eq("company_id", args.companyId);
  if (modules.length) {
    await args.admin.from("company_modules").insert(
      modules.map((m) => ({ company_id: args.companyId, module_key: m, enabled: true })),
    );
  }

  await writeAuditLog(args.admin, {
    companyId: args.companyId,
    userId: args.actorUserId,
    action: "company_modules.update",
    entityType: "company_modules",
    newData: { modules },
  });
  return { ok: true };
}

/** Resetea la contraseña del Dueño de una empresa (jerarquía Superusuario→Dueño). */
export async function resetOwnerPassword(args: {
  admin: SupabaseClient;
  actorUserId: string;
  companyId: string;
  newPassword: string;
}): Promise<ServiceResult> {
  if (args.newPassword.length < 8) {
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const { data: membership } = await args.admin
    .from("memberships")
    .select("user_id")
    .eq("company_id", args.companyId)
    .eq("role", "owner")
    .eq("status", "active")
    .maybeSingle();
  if (!membership) return { ok: false, error: "Dueño no encontrado." };

  const { error } = await args.admin.auth.admin.updateUserById(membership.user_id, {
    password: args.newPassword,
  });
  if (error) return { ok: false, error: "No se pudo resetear la contraseña." };

  await args.admin
    .from("profiles")
    .update({ force_password_change: true })
    .eq("id", membership.user_id);

  await writeAuditLog(args.admin, {
    companyId: args.companyId,
    userId: args.actorUserId,
    action: "users.reset_password",
    entityType: "profiles",
    entityId: membership.user_id,
  });

  return { ok: true, provisionalPassword: args.newPassword };
}

export type { ModuleKey };
