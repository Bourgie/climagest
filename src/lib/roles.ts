export const COMPANY_ROLES = ["owner", "admin", "technician"] as const;
export type Role = (typeof COMPANY_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Dueño",
  admin: "Administrativo",
  technician: "Técnico",
};

/** Roles que el Dueño puede gestionar (no incluye owner). */
export const MANAGEABLE_ROLES: Role[] = ["admin", "technician"];
