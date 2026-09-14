import { createAdminClient } from "@/lib/supabase/admin";
import { emitNotification, notifyPaymentOverdue, notifyUpcomingMaintenance } from "@/server/services/notifications";

const CRON_SECRET = process.env.CRON_SECRET;

function verifyCron(req: Request): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!verifyCron(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const results: Record<string, { ok: boolean; count: number; error?: string }> = {};

  try {
    // 1. Turnos de mañana (notificar a owner/admin/technician asignado)
    const { data: todayAppointments } = await admin
      .from("appointments")
      .select("id, company_id, scheduled_at, client_id, technician_id, branch_id")
      .eq("status", "programado")
      .gte("scheduled_at", new Date().toISOString().split("T")[0] + "T00:00:00")
      .lte("scheduled_at", new Date().toISOString().split("T")[0] + "T23:59:59");

    let appointmentCount = 0;
    for (const appt of todayAppointments ?? []) {
      const { data: client } = await admin.from("clients").select("name").eq("id", appt.client_id).maybeSingle();
      const { data: techs } = await admin
        .from("appointment_technicians")
        .select("technician_id")
        .eq("appointment_id", appt.id);

      if (client && techs?.length) {
        await emitNotification({
          companyId: appt.company_id,
          type: "turno_manana",
          title: "Turno programado para hoy",
          body: `${client.name} — ${new Date(appt.scheduled_at).toLocaleString("es-AR")}`,
          targetRole: undefined, // todos (owner, admin, technician)
          relatedTable: "appointments",
          relatedId: appt.id,
        });
        appointmentCount++;
      }
    }
    results.appointments = { ok: true, count: appointmentCount };

    // 2. Pagos vencidos (cargos pendientes/parciales con due_date pasada)
    const { data: overdueCharges } = await admin
      .from("account_charges")
      .select("id, company_id, client_id, amount, due_date")
      .in("status", ["pendiente", "parcial"])
      .lt("due_date", new Date().toISOString().split("T")[0]);

    let overdueCount = 0;
    for (const charge of overdueCharges ?? []) {
      const { data: client } = await admin.from("clients").select("name").eq("id", charge.client_id).maybeSingle();
      if (client) {
        await notifyPaymentOverdue({
          admin,
          companyId: charge.company_id,
          clientName: client.name,
          amount: Number(charge.amount),
        });
        overdueCount++;
      }
    }
    results.overduePayments = { ok: true, count: overdueCount };

    // 3. Mantenimientos próximos (próximos 7 días)
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const { data: upcomingMaintenance } = await admin
      .from("maintenance_plans")
      .select("id, company_id, equipment_id, next_date")
      .eq("active", true)
      .lte("next_date", nextWeek)
      .gte("next_date", new Date().toISOString().split("T")[0]);

    let maintenanceCount = 0;
    for (const plan of upcomingMaintenance ?? []) {
      const { data: eq } = await admin
        .from("equipment")
        .select("brand, model, client_id")
        .eq("id", plan.equipment_id)
        .maybeSingle();
      if (eq) {
        const { data: client } = await admin.from("clients").select("name").eq("id", eq.client_id).maybeSingle();
        await notifyUpcomingMaintenance({
          admin,
          companyId: plan.company_id,
          equipmentId: plan.equipment_id,
          equipmentBrand: eq.brand ?? "Equipo",
          equipmentModel: eq.model ?? "",
          nextDate: plan.next_date,
        });
        maintenanceCount++;
      }
    }
    results.upcomingMaintenance = { ok: true, count: maintenanceCount };

    // 4. Garantías por vencer (próximos 30 días) - opcional
    const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
    const { data: expiringWarranties } = await admin
      .from("work_orders")
      .select("id, company_id, equipment_id, client_id, warranty_until")
      .eq("status", "completado")
      .not("warranty_until", "is", null)
      .lte("warranty_until", nextMonth)
      .gte("warranty_until", new Date().toISOString().split("T")[0]);

    let warrantyCount = 0;
    for (const wo of expiringWarranties ?? []) {
      const { data: eq } = await admin
        .from("equipment")
        .select("brand, model")
        .eq("id", wo.equipment_id)
        .maybeSingle();
      const { data: client } = await admin.from("clients").select("name").eq("id", wo.client_id).maybeSingle();
      if (eq && client) {
        await emitNotification({
          companyId: wo.company_id,
          type: "garantia",
          title: "⚠️ Garantía por vencer",
          body: `${client.name} — ${eq.brand ?? ""} ${eq.model ?? ""} (vence ${wo.warranty_until})`,
          targetRole: "owner",
          relatedTable: "work_orders",
          relatedId: wo.id,
        });
        await emitNotification({
          companyId: wo.company_id,
          type: "garantia",
          title: "⚠️ Garantía por vencer",
          body: `${client.name} — ${eq.brand ?? ""} ${eq.model ?? ""} (vence ${wo.warranty_until})`,
          targetRole: "admin",
          relatedTable: "work_orders",
          relatedId: wo.id,
        });
        warrantyCount++;
      }
    }
    results.expiringWarranties = { ok: true, count: warrantyCount };

    // Registrar ejecución en job_runs
    const runKey = `daily-${new Date().toISOString().split("T")[0]}`;
    await admin.from("job_runs").upsert({
      job_name: "daily_reminders",
      run_key: runKey,
      status: "ok",
      detail: results,
      finished_at: new Date().toISOString(),
    });

    return Response.json({ ok: true, results });
  } catch (e: any) {
    const runKey = `daily-${new Date().toISOString().split("T")[0]}`;
    await admin.from("job_runs").upsert({
      job_name: "daily_reminders",
      run_key: runKey,
      status: "error",
      detail: { error: e.message },
      finished_at: new Date().toISOString(),
    });
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}