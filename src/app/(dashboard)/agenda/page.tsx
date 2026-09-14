import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission, requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppointmentRow, type AppointmentRowData } from "./appointment-row";
import { LogoutButton } from "@/app/logout-button";

export default async function AgendaPage() {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/");

  const [canView, canCreate, canUpdate, canDelete] = await Promise.all([
    hasPermission(user, "appointments.view"),
    hasPermission(user, "appointments.create"),
    hasPermission(user, "appointments.update"),
    hasPermission(user, "appointments.delete"),
  ]);
  if (!canView) redirect("/");

  const admin = createAdminClient();

  const { data: appointments } = await admin
    .from("appointments")
    .select("id, scheduled_at, status, client_id, appointment_technicians(technician_id)")
    .eq("company_id", user.companyId)
    .order("scheduled_at", { ascending: true });

  const { data: clients } = await admin
    .from("clients")
    .select("id, name")
    .eq("company_id", user.companyId);
  const nameById = new Map((clients ?? []).map((c) => [c.id, c.name]));

  const { data: profiles } = await admin.from("profiles").select("id, full_name");
  const profileName = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const rows: AppointmentRowData[] = (appointments ?? []).map((a) => ({
    id: a.id,
    scheduled_at: a.scheduled_at,
    status: a.status,
    client_name: nameById.get(a.client_id) ?? "—",
    technicians: (a.appointment_technicians ?? []).map(
      (t) => profileName.get(t.technician_id) ?? "Técnico",
    ),
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Agenda</h1>
        <div className="flex items-center gap-3">
          {canCreate && (
            <Link
              href="/agenda/nuevo"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Nuevo turno
            </Link>
          )}
          <LogoutButton />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        {rows.length === 0 && <p className="text-sm text-zinc-500">Sin turnos.</p>}
        {rows.map((a) => (
          <AppointmentRow
            key={a.id}
            appointment={a}
            canUpdate={canUpdate}
            canDelete={canDelete}
          />
        ))}
      </section>
    </main>
  );
}
