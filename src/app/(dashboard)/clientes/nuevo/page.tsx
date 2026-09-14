import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission, requireUser } from "@/server/auth";
import { ClientForm } from "../client-form";

export default async function NuevoClientePage() {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/");
  if (!(await hasPermission(user, "clients.create"))) redirect("/clientes");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center gap-4">
        <Link href="/clientes" className="text-sm text-zinc-500">
          ← Volver
        </Link>
        <h1 className="text-2xl font-semibold">Nuevo cliente</h1>
      </div>
      <ClientForm mode="create" />
    </main>
  );
}
