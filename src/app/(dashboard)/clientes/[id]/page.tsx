import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasPermission, requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientForm } from "../client-form";
import { DeleteClientButton } from "../delete-client-button";

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/");

  const [canView, canUpdate, canDelete] = await Promise.all([
    hasPermission(user, "clients.view"),
    hasPermission(user, "clients.update"),
    hasPermission(user, "clients.delete"),
  ]);
  if (!canView) redirect("/clientes");

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select(
      "id, name, notes, client_addresses(label, address, is_primary), client_contacts(name, role_label, phone, email)",
    )
    .eq("id", id)
    .eq("company_id", user.companyId)
    .maybeSingle();

  if (!client) notFound();

  const initial = {
    id: client.id,
    name: client.name,
    notes: client.notes ?? "",
    addresses: (client.client_addresses ?? []).map((a) => ({
      label: a.label ?? "",
      address: a.address,
      isPrimary: a.is_primary,
    })),
    contacts: (client.client_contacts ?? []).map((c) => ({
      name: c.name,
      roleLabel: c.role_label ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
    })),
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/clientes" className="text-sm text-zinc-500">
            ← Volver
          </Link>
          <h1 className="text-2xl font-semibold">{client.name}</h1>
        </div>
        {canDelete && <DeleteClientButton clientId={client.id} />}
      </div>

      {canUpdate ? (
        <ClientForm mode="edit" initial={initial} />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-500">{client.notes || "Sin notas."}</p>
          <div>
            <p className="font-medium">Direcciones</p>
            {(client.client_addresses ?? []).map((a, i) => (
              <p key={i} className="text-sm">
                {a.address}
                {a.is_primary ? " (primaria)" : ""}
                {a.label ? ` — ${a.label}` : ""}
              </p>
            ))}
          </div>
          <div>
            <p className="font-medium">Contactos</p>
            {(client.client_contacts ?? []).map((c, i) => (
              <p key={i} className="text-sm">
                {c.name}
                {c.role_label ? ` (${c.role_label})` : ""}
                {c.phone ? ` · ${c.phone}` : ""}
                {c.email ? ` · ${c.email}` : ""}
              </p>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
