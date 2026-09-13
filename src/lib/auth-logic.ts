/**
 * Lógica pura de decisión de permisos (sin I/O, sin server-only) para poder
 * testearla de forma aislada. La capa de datos vive en src/server/auth.ts.
 */

export type PermissionSubject = {
  isSuperuser: boolean;
  companyId: string | null;
  role: string | null;
};

/**
 * Decisión de permiso granular de negocio (capa de aplicación, no RLS).
 * - Superusuario: bypass (todo).
 * - Sin empresa o sin rol: denegado.
 * - Con empresa y rol: respeta el valor `allowed` de role_permissions
 *   (denegado por defecto si no hay fila).
 */
export function resolvePermission(
  subject: PermissionSubject,
  allowed: boolean | undefined,
): boolean {
  if (subject.isSuperuser) return true;
  if (!subject.companyId || !subject.role) return false;
  return allowed ?? false;
}

/**
 * Una empresa suspendida o bloqueada no puede iniciar sesión.
 */
export function isCompanyLoginBlocked(status: string): boolean {
  return status === "suspended" || status === "blocked";
}
