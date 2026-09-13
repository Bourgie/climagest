import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission, requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { QuoteForm, type QuoteClientOption, type QuoteEquipmentOption } from "../quote-form";

export default async function NuevoPresupuestoPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  const { pedido } = await searchParams;
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/");
  if (!(await hasPermission(user, "quotes.create"))) redirect("/presupuestos");

  const admin = createAdminClient();

  const { data: clients } = await admin
    .from("clients")
    .select("id, name")
    .eq("company_id", user.companyId)
    .order("name");
  const { data: equipment } = await admin
    .from("equipment")
    .select("id, brand, model")
    .eq("company_id", user.companyId);

  let prefill:
    | { serviceRequestId: string | null; clientId?: string; equipmentId?: string | null }
    | undefined;

  if (pedido) {
    const { data: sr } = await admin
      .from("service_requests")
      .select("id, client_id, equipment_id")
      .eq("id", pedido)
      .eq("company_id", user.companyId)
      .maybeSingle();
    if (sr) {
      prefill = {
        serviceRequestId: sr.id,
        clientId: sr.client_id,
        equipmentId: sr.equipment_id,
      };
    }
  }

  const clientOptions: QuoteClientOption[] = (clients ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const equipmentOptions: QuoteEquipmentOption[] = (equipment ?? []).map((e) => ({
    id: e.id,
    label: `${e.brand ?? ""} ${e.model ?? ""}`.trim() || "Equipo",
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center gap-4">
        <Link href="/presupuestos" className="text-sm text-zinc-500">
          ← Volver
        </Link>
        <h1 className="text-2xl font-semibold">Nuevo presupuesto</h1>
      </div>
      <QuoteForm
        mode="create"
        clients={clientOptions}
        equipment={equipmentOptions}
        initial={
          prefill
            ? {
                id: "",
                serviceRequestId: prefill.serviceRequestId,
                clientId: prefill.clientId ?? "",
                equipmentId: prefill.equipmentId ?? null,
                items: [{ description: "", type: "mano_obra", quantity: 1, unitPrice: 0 }],
                discount: 0,
                paymentTerms: "",
                validUntil: "",
              }
            : undefined
        }
      />
    </main>
  );
}
