import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasPermission, requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { finishWorkOrderAction, startWorkOrderAction } from "@/server/actions/work-orders";

const STATUS_LABELS: Record<string, string> = {
  borrador: "Borrador",
  en_progreso: "En curso",
  completado: "Completado",
  cancelado: "Cancelado",
};

const VISIT_LABELS: Record<string, string> = {
  instalacion: "Instalación",
  mantenimiento: "Mantenimiento",
  reparacion: "Reparación",
  limpieza: "Limpieza",
  otro: "Otro",
};

export default async function OrdenDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/");

  const [canView, canUpdate] = await Promise.all([
    hasPermission(user, "work_orders.view"),
    hasPermission(user, "work_orders.update"),
  ]);
  if (!canView) redirect("/ordenes");

  const admin = createAdminClient();
  const { data: wo } = await admin
    .from("work_orders")
    .select("*")
    .eq("id", id)
    .eq("company_id", user.companyId)
    .maybeSingle();
  if (!wo) notFound();

  const { data: equipment } = await admin
    .from("equipment")
    .select("brand, model, equipment_type, serial_number")
    .eq("id", wo.equipment_id)
    .maybeSingle();

  const { data: materials } = await admin
    .from("work_order_materials")
    .select("description, quantity, unit_cost, subtotal")
    .eq("work_order_id", id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/ordenes" className="text-sm text-zinc-500">
            ← Volver
          </Link>
          <h1 className="text-2xl font-semibold">
            {equipment?.brand ?? "—"} {equipment?.model ?? ""}
          </h1>
        </div>
        <span className="rounded-md bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-800">
          {STATUS_LABELS[wo.status] ?? wo.status}
        </span>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
        <p>
          <strong>Tipo:</strong> {VISIT_LABELS[wo.visit_type] ?? wo.visit_type}
        </p>
        {wo.diagnosis_notes && (
          <p className="sm:col-span-2">
            <strong>Diagnóstico:</strong> {wo.diagnosis_notes}
          </p>
        )}
        {wo.fault_found && (
          <p className="sm:col-span-2">
            <strong>Falla:</strong> {wo.fault_found}
          </p>
        )}
        {wo.actual_start_at && (
          <p>
            <strong>Inicio:</strong> {new Date(wo.actual_start_at).toLocaleString("es-AR")}
          </p>
        )}
        {wo.actual_end_at && (
          <p>
            <strong>Fin:</strong> {new Date(wo.actual_end_at).toLocaleString("es-AR")}
          </p>
        )}
        {wo.warranty_until && (
          <p>
            <strong>Garantía hasta:</strong> {wo.warranty_until}
          </p>
        )}
      </section>

      {wo.measurements && Object.keys(wo.measurements).length > 0 && (
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <p className="font-medium">Mediciones</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {Object.entries(wo.measurements).map(([k, v]) => (
              <p key={k} className="text-zinc-600 dark:text-zinc-400">
                {k}: <strong>{String(v)}</strong>
              </p>
            ))}
          </div>
        </section>
      )}

      {materials && materials.length > 0 && (
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <p className="font-medium">Materiales usados</p>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {materials.map((m, i) => (
                <tr key={i} className="border-t border-zinc-200 dark:border-zinc-700">
                  <td className="py-1">{m.description}</td>
                  <td className="py-1 text-right">{Number(m.quantity)}</td>
                  <td className="py-1 text-right">${Number(m.unit_cost).toFixed(2)}</td>
                  <td className="py-1 text-right">${Number(m.subtotal).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {canUpdate && wo.status === "borrador" && (
        <form action={startWorkOrderAction}>
          <input type="hidden" name="workOrderId" value={wo.id} />
          <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            Iniciar visita
          </button>
        </form>
      )}
      {canUpdate && wo.status === "en_progreso" && (
        <form action={finishWorkOrderAction}>
          <input type="hidden" name="workOrderId" value={wo.id} />
          <button className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white">
            Finalizar visita
          </button>
        </form>
      )}

      {wo.signature_image && (
        <section>
          <p className="font-medium">Firma del cliente</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={wo.signature_image}
            alt="Firma"
            className="mt-2 max-w-xs rounded-md border border-zinc-200 dark:border-zinc-700"
          />
        </section>
      )}
    </main>
  );
}
