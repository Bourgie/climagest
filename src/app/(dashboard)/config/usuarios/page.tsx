import { redirect } from "next/navigation";
import { hasPermission, requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateUserForm } from "./create-user-form";
import { UserRow, type MemberRow } from "./user-row";
import { LogoutButton } from "@/app/logout-button";

export default async function UsuariosPage() {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/");

  const [canView, canCreate, canUpdate, canReset] = await Promise.all([
    hasPermission(user, "users.view"),
    hasPermission(user, "users.create"),
    hasPermission(user, "users.update"),
    hasPermission(user, "users.reset_password"),
  ]);
  if (!canView) redirect("/");

  const admin = createAdminClient();
  const { data: members } = await admin
    .from("memberships")
    .select("user_id, role, status, profiles(full_name, username)")
    .eq("company_id", user.companyId);

  const rows: MemberRow[] = (members ?? []).map((m) => ({
    user_id: m.user_id,
    role: m.role,
    status: m.status,
    full_name: m.profiles?.[0]?.full_name ?? "",
    username: m.profiles?.[0]?.username ?? "",
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Gestión de usuarios</h1>
        <LogoutButton />
      </div>

      <CreateUserForm canCreate={canCreate} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Usuarios ({rows.length})</h2>
        {rows.map((m) => (
          <UserRow key={m.user_id} member={m} canUpdate={canUpdate} canReset={canReset} />
        ))}
      </section>
    </main>
  );
}
