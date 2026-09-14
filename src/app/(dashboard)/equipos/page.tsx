import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission, requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { EQUIPMENT_TYPE_LABELS } from "@/lib/equipment-types";
import { LogoutButton } from "@/app/logout-button";

export default async function EquiposPage() {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/");

  const [canView, canCreate] = await Promise.all([
    hasPermission(user, "equipment.view"),
    hasPermission(user, "equipment.create"),
  ]);
  if (!canView) redirect("/");

  const admin = createAdminClient();
  const { data: equipment } = await admin
    .from("equipment")
    .select("id, brand, model, equipment_type, client_id")
    .eq("company_id", user.companyId)
    .order("created_at", { ascending: false });

  const { data: clients } = await admin
    .from("clients")
    .select("id, name")
    .eq("company_id", user.companyId);
  const nameById = new Map((clients ?? []).map((c) => [c.id, c.name]));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Equipos</h1>
        <div className="flex items-center gap-3">
          {canCreate && (
            <Link
              href="/equipos/nuevo"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Nuevo equipo
            </Link>
          )}
          <LogoutButton />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        {equipment?.length === 0 && <p className="text-sm text-zinc-500">Sin equipos.</p>}
        {(equipment ?? []).map((e) => (
          <Link
            key={e.id}
            href={`/equipos/${e.id}`}
            className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <p className="font-medium">
              {e.brand ?? "—"} {e.model ?? ""}
              <span className="ml-2 text-sm text-zinc-500">
                {EQUIPMENT_TYPE_LABELS[e.equipment_type] ?? e.equipment_type}
              </span>
            </p>
            <p className="text-sm text-zinc-500">
              {nameById.get(e.client_id) ?? "Cliente desconocido"}
            </p>
          </Link>
        ))}
      </section>
    </main>
  );
}
