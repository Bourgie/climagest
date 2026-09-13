import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "./audit";
import type { ServiceResult } from "./types";

export const APPOINTMENT_STATUSES = ["programado", "confirmado", "en_curso", "completado", "cancelado"] as const;
export const SERVICE_ORIGINS = ["llamada", "email", "web", "qr_publico", "whatsapp", "otro"] as const;

export type AppointmentInput = {
  clientId: string;
  equipmentId?: string | null;
  serviceRequestId?: string | null;
  appointmentType: string;
  scheduledAt: string;
  estimatedDuration?: number | null;
  notes?: string | null;
  technicianIds?: string[];
  origin?: string;
};

/** Valida que los técnicos asignados pertenezcan a la misma empresa (rol technician, activo). */
async function validateTechnicians(
  admin: SupabaseClient,
  companyId: string,
  technicianIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ids = [...new Set(technicianIds)];
  if (!ids.length) return { ok: true };

  const { data: memberships } = await admin
    .from("memberships")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("role", "technician")
    .eq("status", "active")
    .in("user_id", technicianIds);

  const valid = new Set((memberships ?? []).map((m) => m.user_id));
  if (valid.size !== technicianIds.length) {
    return { ok: false, error: "Uno de los técnicos no pertenece a la empresa." };
  }
  return { ok: true };
}

async function validateRefs(
  admin: SupabaseClient,
  companyId: string,
  input: AppointmentInput,
): Promise<{ ok: false; error: string } | { ok: true }> {
  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("id", input.clientId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!client) return { ok: false, error: "Cliente no encontrado." };

  if (input.equipmentId) {
    const { data: equipment } = await admin
      .from("equipment")
      .select("id")
      .eq("id", input.equipmentId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!equipment) return { ok: false, error: "Equipo no encontrado." };
  }

  if (input.serviceRequestId) {
    const { data: sr } = await admin
      .from("service_requests")
      .select("id")
      .eq("id", input.serviceRequestId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!sr) return { ok: false, error: "Pedido no encontrado." };
  }

  return { ok: true };
}

async function replaceTechnicians(
  admin: SupabaseClient,
  appointmentId: string,
  technicianIds: string[],
) {
  await admin
    .from("appointment_technicians")
    .delete()
    .eq("appointment_id", appointmentId);
  const ids = [...new Set(technicianIds)];
  if (ids.length) {
    await admin.from("appointment_technicians").insert(
      ids.map((tech) => ({ appointment_id: appointmentId, technician_id: tech })),
    );
  }
}

export async function createAppointment(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canCreate: boolean;
  input: AppointmentInput;
}): Promise<ServiceResult> {
  if (!args.canCreate) {
    return { ok: false, error: "No tenés permiso para crear turnos." };
  }
  const { admin, company, actorUserId, input } = args;

  if (!SERVICE_ORIGINS.includes(input.origin as never)) {
    return { ok: false, error: "Origen inválido." };
  }

  // Validar que el cliente es de la empresa.
  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("id", input.clientId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!client) return { ok: false, error: "Cliente no encontrado." };

  // Si hay equipo, validar que es de la empresa.
  if (input.equipmentId) {
    const { data: equipment } = await admin
      .from("equipment")
      .select("id")
      .eq("id", input.equipmentId)
      .eq("company_id", company.id)
      .maybeSingle();
    if (!equipment) return { ok: false, error: "Equipo no encontrado." };
  }

  const { data: appointment, error } = await admin
    .from("appointments")
    .insert({
      company_id: company.id,
      client_id: input.clientId,
      equipment_id: input.equipmentId ?? null,
      scheduled_at: input.scheduledAt,
      estimated_duration: input.estimatedDuration ?? null,
      notes: input.notes?.trim() || null,
      status: "programado",
      created_by: actorUserId,
    })
    .select("id")
    .single();
  if (error || !appointment) {
    console.error("Create appointment error:", error);
    return { ok: false, error: `No se pudo crear el turno: ${error?.message ?? "error desconocido"}` };
  }

  if (input.technicianIds && input.technicianIds.length > 0) {
    const techs = await validateTechnicians(admin, company.id, input.technicianIds);
    if (!techs.ok) return { ok: false, error: techs.error };
  }

  await replaceTechnicians(admin, appointment.id, input.technicianIds ?? []);

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "appointments.create",
    entityType: "appointments",
    entityId: appointment.id,
    newData: { appointmentType: input.appointmentType, scheduledAt: input.scheduledAt },
  });

  return { ok: true, appointmentId: appointment.id };
}

export async function updateAppointment(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canUpdate: boolean;
  appointmentId: string;
  input: AppointmentInput;
}): Promise<ServiceResult> {
  if (!args.canUpdate) return { ok: false, error: "No autorizado." };
  const { admin, company, actorUserId, appointmentId, input } = args;

  const { data: existing } = await admin
    .from("appointments")
    .select("id")
    .eq("id", appointmentId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Turno no encontrado." };

  const updates: Record<string, unknown> = {};
  if (input.appointmentType) updates.appointment_type = input.appointmentType;
  if (input.scheduledAt) updates.scheduled_at = input.scheduledAt;
  if (input.estimatedDuration) updates.estimated_duration = input.estimatedDuration;
  if (input.notes !== undefined) updates.notes = input.notes?.trim() || null;

  const { error } = await admin.from("appointments").update(updates).eq("id", appointmentId);
  if (error) return { ok: false, error: "No se pudo actualizar el turno." };

  if (input.technicianIds) {
    const techs = await validateTechnicians(admin, company.id, input.technicianIds);
    if (!techs.ok) return { ok: false, error: techs.error };
    await admin.from("appointment_technicians").delete().eq("appointment_id", appointmentId);
    if (input.technicianIds.length) {
      await admin.from("appointment_technicians").insert(
        input.technicianIds.map((tid) => ({ appointment_id: appointmentId, technician_id: tid })),
      );
    }
  }

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "appointments.update",
    entityType: "appointments",
    entityId: appointmentId,
    newData: input,
  });

  return { ok: true };
}

export async function deleteAppointment(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canDelete: boolean;
  appointmentId: string;
}): Promise<ServiceResult> {
  if (!args.canDelete) return { ok: false, error: "No autorizado." };
  const { admin, company, actorUserId, appointmentId } = args;

  const { data: existing } = await admin
    .from("appointments")
    .select("id")
    .eq("id", appointmentId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Turno no encontrado." };

  await admin.from("appointments").delete().eq("id", appointmentId);

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "appointments.delete",
    entityType: "appointments",
    entityId: appointmentId,
  });

  return { ok: true };
}

export async function updateAppointmentStatus(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canUpdate: boolean;
  appointmentId: string;
  status: string;
}): Promise<ServiceResult> {
  if (!args.canUpdate) return { ok: false, error: "No autorizado." };
  const { admin, company, actorUserId, appointmentId, status } = args;

  if (!APPOINTMENT_STATUSES.includes(status as never)) {
    return { ok: false, error: "Estado inválido." };
  }

  const { data: existing } = await admin
    .from("appointments")
    .select("status")
    .eq("id", appointmentId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Turno no encontrado." };

  const { error } = await admin
    .from("appointments")
    .update({ status })
    .eq("id", appointmentId);
  if (error) return { ok: false, error: "No se pudo actualizar el turno." };

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "appointments.update_status",
    entityType: "appointments",
    entityId: appointmentId,
    newData: { status },
  });

  return { ok: true };
}

export async function createAppointmentFromQr(args: {
  admin: SupabaseClient;
  token: string;
  visitorName: string;
  visitorContact: string;
  message?: string;
}): Promise<ServiceResult> {
  const name = args.visitorName.trim();
  const contact = args.visitorContact.trim();
  if (!name || !contact) {
    return { ok: false, error: "Nombre y contacto son requeridos." };
  }

  const { data: equipment } = await args.admin
    .from("equipment")
    .select("id, client_id, company_id")
    .eq("qr_token", args.token)
    .maybeSingle();
  if (!equipment) return { ok: false, error: "Equipo no encontrado." };

  const description = args.message?.trim()
    ? `${args.message.trim()} — Contacto: ${name} (${contact})`
    : `Solicitud desde QR — Contacto: ${name} (${contact})`;

  const { data: appointment, error } = await args.admin
    .from("appointments")
    .insert({
      company_id: equipment.company_id,
      client_id: equipment.client_id,
      equipment_id: equipment.id,
      origin: "qr_publico",
      description,
      status: "programado",
      created_by: "public",
    })
    .select("id")
    .single();
  if (error || !appointment) return { ok: false, error: "No se pudo registrar el turno." };

  await writeAuditLog(args.admin, {
    companyId: equipment.company_id,
    userId: null,
    action: "appointments.create_from_qr",
    entityType: "appointments",
    entityId: appointment.id,
    newData: { visitorName: name, visitorContact: contact },
  });

  return { ok: true, appointmentId: appointment.id };
}