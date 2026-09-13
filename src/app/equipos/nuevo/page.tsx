import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission, requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { EquipmentForm, type EquipmentClientOption } from "../equipment-form";

export default async function NuevoEquipoPage() {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/");
  if (!(await hasPermission(user, "equipment.create"))) redirect("/equipos");

  const admin = createAdminClient();
  const { data: clients } = await admin
    .from("clients")
    .select("id, name, client_addresses(id, address, label)")
    .eq("company_id", user.companyId)
    .order("name");

  const options: EquipmentClientOption[] = (clients ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    addresses: (c.client_addresses ?? []).map((a) => ({
      id: a.id,
      address: a.address,
      label: a.label,
    })),
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center gap-4">
        <Link href="/equipos" className="text-sm text-zinc-500">
          ← Volver
        </Link>
        <h1 className="text-2xl font-semibold">Nuevo equipo</h1>
      </div>
      <EquipmentForm mode="create" clients={options} />
    </main>
  );
}
