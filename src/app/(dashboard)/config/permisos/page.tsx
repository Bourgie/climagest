import { redirect } from "next/navigation";
import { hasPermission, requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PermissionsForm, type PermissionItem } from "./permissions-form";
import { LogoutButton } from "@/app/logout-button";

export default async function PermisosPage() {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/");

  const canUpdate = await hasPermission(user, "role_permissions.update");
  if (!canUpdate) redirect("/");

  const admin = createAdminClient();

  const { data: permissions } = await admin
    .from("permissions")
    .select("key, label, category")
    .order("category")
    .order("key");

  const { data: rp } = await admin
    .from("role_permissions")
    .select("role, permission_key, allowed")
    .eq("company_id", user.companyId);

  const allowedByRole = new Map<string, Set<string>>();
  for (const r of rp ?? []) {
    if (!r.allowed) continue;
    const set = allowedByRole.get(r.role) ?? new Set<string>();
    set.add(r.permission_key);
    allowedByRole.set(r.role, set);
  }

  const items: PermissionItem[] = (permissions ?? []).map((p) => ({
    key: p.key,
    label: p.label,
    category: p.category,
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Configurar permisos</h1>
        <LogoutButton />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Administrativo</h2>
        <PermissionsForm
          role="admin"
          permissions={items}
          initialAllowed={allowedByRole.get("admin") ?? new Set()}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Técnico</h2>
        <PermissionsForm
          role="technician"
          permissions={items}
          initialAllowed={allowedByRole.get("technician") ?? new Set()}
        />
      </section>
    </main>
  );
}
