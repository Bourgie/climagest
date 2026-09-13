import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission, requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppointmentForm, type ApptClientOption, type ApptEquipmentOption, type ApptTechnicianOption } from "../appointment-form";

export default async function NuevoTurnoPage() {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/");
  if (!(await hasPermission(user, "appointments.create"))) redirect("/agenda");

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
  const { data: techs } = await admin
    .from("memberships")
    .select("user_id, profiles(full_name)")
    .eq("company_id", user.companyId)
    .eq("role", "technician")
    .eq("status", "active");

  const clientOptions: ApptClientOption[] = (clients ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const equipmentOptions: ApptEquipmentOption[] = (equipment ?? []).map((e) => ({
    id: e.id,
    label: `${e.brand ?? ""} ${e.model ?? ""}`.trim() || "Equipo",
  }));
  const technicianOptions: ApptTechnicianOption[] = (techs ?? []).map((t) => ({
    id: t.user_id,
    name: t.profiles?.[0]?.full_name ?? "Técnico",
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center gap-4">
        <Link href="/agenda" className="text-sm text-zinc-500">
          ← Volver
        </Link>
        <h1 className="text-2xl font-semibold">Nuevo turno</h1>
      </div>
      <AppointmentForm
        mode="create"
        clients={clientOptions}
        equipment={equipmentOptions}
        technicians={technicianOptions}
      />
    </main>
  );
}
