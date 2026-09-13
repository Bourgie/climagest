import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { resolvePermission } from "@/lib/auth-logic";
import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "admin" | "technician";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  username: string;
  isSuperuser: boolean;
  forcePasswordChange: boolean;
  companyId: string | null;
  role: Role | null;
};

/**
 * Usuario autenticado actual (sesión + perfil + membership).
 * Usa el server client, con lo que RLS garantiza el aislamiento de los datos
 * que se leen (solo la propia fila de profiles/memberships).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, username, is_superuser, force_password_change")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  let companyId: string | null = null;
  let role: Role | null = null;

  if (!profile.is_superuser) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("company_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    companyId = membership?.company_id ?? null;
    role = (membership?.role as Role | undefined) ?? null;
  }

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile.full_name,
    username: profile.username,
    isSuperuser: profile.is_superuser,
    forcePasswordChange: profile.force_password_change,
    companyId,
    role,
  };
});

/** Redirige a /login si no hay sesión; si la hay, devuelve el usuario. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Exige sesión de Superusuario (plataforma); si no, redirige a la home. */
export async function requireSuperuser(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isSuperuser) redirect("/");
  return user;
}

/**
 * Chequeo de permiso granular de negocio (capa de aplicación).
 * NO vive en RLS (que solo aísla por empresa). Se consulta en Server Actions
 * antes de ejecutar acciones sensibles. Ver skill permisos-granulares.
 *
 * - Superusuario: tiene todo (bypass).
 * - Usuario de empresa: consulta role_permissions(company_id, role, key).
 */
export async function hasPermission(
  user: CurrentUser,
  permissionKey: string,
): Promise<boolean> {
  if (user.isSuperuser) return true;
  if (!user.companyId || !user.role) return false;

  const supabase = await createClient();
  const { data } = await supabase
    .from("role_permissions")
    .select("allowed")
    .eq("company_id", user.companyId)
    .eq("role", user.role)
    .eq("permission_key", permissionKey)
    .maybeSingle();

  return resolvePermission(user, data?.allowed);
}
