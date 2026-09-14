import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission, requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { LogoutButton } from "@/app/logout-button";

type AddressRow = { label: string | null; address: string; is_primary: boolean };
type ClientRow = {
  id: string;
  name: string;
  addresses: AddressRow[];
  contactCount: number;
};

export default async function ClientesPage() {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/");

  const [canView, canCreate] = await Promise.all([
    hasPermission(user, "clients.view"),
    hasPermission(user, "clients.create"),
  ]);
  if (!canView) redirect("/");

  const admin = createAdminClient();
  const { data: clients } = await admin
    .from("clients")
    .select(
      "id, name, client_addresses(label, address, is_primary), client_contacts(id)",
    )
    .eq("company_id", user.companyId)
    .order("name");

  const rows: ClientRow[] = (clients ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    addresses: (c.client_addresses ?? []) as AddressRow[],
    contactCount: (c.client_contacts ?? []).length,
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <div className="flex items-center gap-3">
          {canCreate && (
            <Link
              href="/clientes/nuevo"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Nuevo cliente
            </Link>
          )}
          <LogoutButton />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        {rows.length === 0 && <p className="text-sm text-zinc-500">Sin clientes.</p>}
        {rows.map((c) => {
          const primary = c.addresses.find((a) => a.is_primary) ?? c.addresses[0];
          return (
            <Link
              key={c.id}
              href={`/clientes/${c.id}`}
              className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <p className="font-medium">{c.name}</p>
              <p className="text-sm text-zinc-500">
                {primary ? primary.address : "Sin dirección"} · {c.contactCount}{" "}
                contacto{c.contactCount === 1 ? "" : "s"}
              </p>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
