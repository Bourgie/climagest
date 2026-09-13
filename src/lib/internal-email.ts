/**
 * Email sintético interno de Supabase Auth.
 * Nunca se muestra ni se le pide al usuario final: es un detalle de
 * implementación para que todas las empresas compartan el mismo proyecto
 * Supabase (ver skill gestion-usuarios-auth).
 *
 * Formato determinístico: `{username}+{company_code}@internal.app`.
 * La unicidad de username por empresa queda garantizada por el UNIQUE de
 * `profiles.internal_email` (mismo username + misma empresa → mismo email).
 */
export function buildInternalEmail(
  username: string,
  companyCode: string,
): string {
  return `${username.toLowerCase()}+${companyCode.toLowerCase()}@internal.app`;
}
