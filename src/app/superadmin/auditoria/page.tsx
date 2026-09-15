import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { LogoutButton } from "@/app/logout-button";
import { Header } from "@/components/layout/Header";
import { AuditTable } from "./audit-table";

export default async function AuditoriaPage() {
  const user = await getCurrentUser();
  if (!user || !user.isSuperuser) redirect("/login");

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <Header user={{ role: "owner", isSuperuser: true, companyId: undefined }} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Auditoría</h1>
          <p className="text-sm text-zinc-500 mt-1">Logs de acciones de la plataforma</p>
        </div>
        <a
          href="/superadmin/auditoria/export"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Exportar CSV
        </a>
      </div>

      <AuditTable />
    </main>
  );
}