import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission, requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { LogoutButton } from "@/app/logout-button";

const STATUS_LABELS: Record<string, string> = {
  borrador: "Borrador",
  en_progreso: "En curso",
  completado: "Completado",
  cancelado: "Cancelado",
};

export default async function OrdenesPage() {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/");

  const [canView, canCreate] = await Promise.all([
    hasPermission(user, "work_orders.view"),
    hasPermission(user, "work_orders.create"),
  ]);
  if (!canView) redirect("/");

  const admin = createAdminClient();

  const { data: workOrders } = await admin
    .from("work_orders")
    .select("id, visit_type, status, created_at, equipment_id")
    .eq("company_id", user.companyId)
    .order("created_at", { ascending: false });

  const { data: equipment } = await admin
    .from("equipment")
    .select("id, brand, model")
    .eq("company_id", user.companyId);
  const equipmentLabel = new Map(
    (equipment ?? []).map((e) => [
      e.id,
      `${e.brand ?? ""} ${e.model ?? ""}`.trim() || "Equipo",
    ]),
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Órdenes de trabajo</h1>
        <div className="flex items-center gap-3">
          {canCreate && (
            <Link
              href="/ordenes/nuevo"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Nueva orden
            </Link>
          )}
          <LogoutButton />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        {workOrders?.length === 0 && <p className="text-sm text-zinc-500">Sin órdenes.</p>}
        {(workOrders ?? []).map((wo) => (
          <Link
            key={wo.id}
            href={`/ordenes/${wo.id}`}
            className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <div className="flex flex-col gap-1">
              <p className="font-medium">{equipmentLabel.get(wo.equipment_id) ?? "—"}</p>
              <p className="text-sm text-zinc-500">
                {wo.visit_type} · {STATUS_LABELS[wo.status] ?? wo.status}
              </p>
            </div>
            <p className="text-sm text-zinc-500">
              {new Date(wo.created_at).toLocaleDateString("es-AR")}
            </p>
          </Link>
        ))}
      </section>
    </main>
  );
}
