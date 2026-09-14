import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission, requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { WorkOrderForm, type WoEquipmentOption } from "../work-order-form";

export default async function NuevaOrdenPage({
  searchParams,
}: {
  searchParams: Promise<{ equipo?: string }>;
}) {
  const { equipo } = await searchParams;
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/");
  if (!(await hasPermission(user, "work_orders.create"))) redirect("/ordenes");

  const admin = createAdminClient();
  const { data: equipment } = await admin
    .from("equipment")
    .select("id, brand, model")
    .eq("company_id", user.companyId)
    .order("brand");

  const options: WoEquipmentOption[] = (equipment ?? []).map((e) => ({
    id: e.id,
    label: `${e.brand ?? ""} ${e.model ?? ""}`.trim() || "Equipo",
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center gap-4">
        <Link href="/ordenes" className="text-sm text-zinc-500">
          ← Volver
        </Link>
        <h1 className="text-2xl font-semibold">Nueva orden de trabajo</h1>
      </div>
      <WorkOrderForm equipment={options} initialEquipmentId={equipo} />
    </main>
  );
}
