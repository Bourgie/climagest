import { redirect } from "next/navigation";
import { hasPermission, requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateServiceRequestForm } from "./create-service-request-form";
import { ServiceRequestRow, type ServiceRequestRow as SrRow } from "./service-request-row";
import { LogoutButton } from "@/app/logout-button";

export default async function PedidosPage() {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/");

  const [canView, canCreate, canUpdate] = await Promise.all([
    hasPermission(user, "service_requests.view"),
    hasPermission(user, "service_requests.create"),
    hasPermission(user, "service_requests.update"),
  ]);
  if (!canView) redirect("/");

  const admin = createAdminClient();

  const { data: requests } = await admin
    .from("service_requests")
    .select("id, origin, status, description, created_at, client_id")
    .eq("company_id", user.companyId)
    .order("created_at", { ascending: false });

  const { data: clients } = await admin
    .from("clients")
    .select("id, name")
    .eq("company_id", user.companyId)
    .order("name");
  const { data: equipment } = await admin
    .from("equipment")
    .select("id, brand, model")
    .eq("company_id", user.companyId);

  const nameById = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const rows: SrRow[] = (requests ?? []).map((r) => ({
    id: r.id,
    origin: r.origin,
    status: r.status,
    description: r.description,
    created_at: r.created_at,
    client_name: nameById.get(r.client_id) ?? "—",
  }));

  const clientOptions = (clients ?? []).map((c) => ({ id: c.id, name: c.name }));
  const equipmentOptions = (equipment ?? []).map((e) => ({
    id: e.id,
    label: `${e.brand ?? ""} ${e.model ?? ""}`.trim() || "Equipo",
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pedidos</h1>
        <LogoutButton />
      </div>

      {canCreate && (
        <CreateServiceRequestForm clients={clientOptions} equipment={equipmentOptions} />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Pedidos ({rows.length})</h2>
        {rows.length === 0 && <p className="text-sm text-zinc-500">Sin pedidos.</p>}
        {rows.map((r) => (
          <ServiceRequestRow key={r.id} request={r} canUpdate={canUpdate} />
        ))}
      </section>
    </main>
  );
}
