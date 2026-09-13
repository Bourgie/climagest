import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "./audit";
import type { ServiceResult } from "./types";

export const SERVICE_ORIGINS = ["llamada", "whatsapp", "qr_publico", "presencial"] as const;
export const SERVICE_STATUSES = [
  "recibido",
  "presupuestado",
  "agendado",
  "en_curso",
  "resuelto",
  "cancelado",
] as const;

export type ServiceRequestInput = {
  clientId: string;
  equipmentId?: string | null;
  origin: string;
  description?: string;
};

export type ServiceRequestResult =
  | { ok: true; requestId: string }
  | { ok: false; error: string };

export async function createServiceRequest(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canCreate: boolean;
  input: ServiceRequestInput;
}): Promise<ServiceRequestResult> {
  if (!args.canCreate) {
    return { ok: false, error: "No tenés permiso para crear pedidos." };
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

  const { data: request, error } = await admin
    .from("service_requests")
    .insert({
      company_id: company.id,
      client_id: input.clientId,
      equipment_id: input.equipmentId ?? null,
      origin: input.origin,
      description: input.description?.trim() || null,
      status: "recibido",
      created_by: actorUserId,
    })
    .select("id")
    .single();

  if (error || !request) return { ok: false, error: "No se pudo crear el pedido." };

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "service_requests.create",
    entityType: "service_requests",
    entityId: request.id,
    newData: { clientId: input.clientId, origin: input.origin },
  });

  return { ok: true, requestId: request.id };
}

export async function updateServiceRequestStatus(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canUpdate: boolean;
  requestId: string;
  status: string;
}): Promise<ServiceResult> {
  if (!args.canUpdate) return { ok: false, error: "No autorizado." };
  const { admin, company, actorUserId, requestId, status } = args;

  if (!SERVICE_STATUSES.includes(status as never)) {
    return { ok: false, error: "Estado inválido." };
  }

  const { data: existing } = await admin
    .from("service_requests")
    .select("status")
    .eq("id", requestId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Pedido no encontrado." };

  const { error } = await admin
    .from("service_requests")
    .update({ status })
    .eq("id", requestId);
  if (error) return { ok: false, error: "No se pudo actualizar el pedido." };

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "service_requests.update_status",
    entityType: "service_requests",
    entityId: requestId,
    oldData: { status: existing.status },
    newData: { status },
  });

  return { ok: true };
}

/**
 * Pedido creado desde el QR público ("Solicitar servicio"). Resuelve el equipo
 * por token y crea el service_request con origin=qr_publico + una qr_inquiry
 * con el contacto del visitante.
 */
export async function createServiceRequestFromQr(args: {
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

  const { data: request, error } = await args.admin
    .from("service_requests")
    .insert({
      company_id: equipment.company_id,
      client_id: equipment.client_id,
      equipment_id: equipment.id,
      origin: "qr_publico",
      description,
      status: "recibido",
    })
    .select("id")
    .single();
  if (error || !request) return { ok: false, error: "No se pudo registrar el pedido." };

  await args.admin.from("qr_inquiries").insert({
    equipment_id: equipment.id,
    visitor_name: name,
    visitor_contact: contact,
    message: args.message?.trim() || null,
    status: "nuevo",
  });

  return { ok: true };
}
