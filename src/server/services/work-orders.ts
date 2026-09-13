import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "./audit";
import type { ServiceResult } from "./types";

export const WORK_ORDER_STATUSES = ["borrador", "en_progreso", "completado", "cancelado"] as const;
export const VISIT_TYPES = ["instalacion", "mantenimiento", "reparacion", "limpieza", "otro"] as const;

export type Measurements = {
  presion_baja?: number | null;
  presion_alta?: number | null;
  temp_retorno?: number | null;
  temp_impulsion?: number | null;
  amperaje?: number | null;
  tension?: number | null;
  superheat?: number | null;
  subcooling?: number | null;
};

export type MaterialInput = { description: string; quantity: number; unitCost: number };

export type WorkOrderInput = {
  equipmentId: string;
  appointmentId?: string | null;
  serviceRequestId?: string | null;
  visitType: string;
  diagnosisNotes?: string;
  measurements?: Measurements | null;
  faultFound?: string;
  signatureImage?: string | null;
  materials: MaterialInput[];
  warrantyDays?: number | null;
};

export type WorkOrderResult = { ok: true; workOrderId: string } | { ok: false; error: string };

const MAX_SIGNATURE_BYTES = 500_000;

function validateSignature(sig?: string | null): { ok: true } | { ok: false; error: string } {
  if (!sig) return { ok: true };
  if (!sig.startsWith("data:image/png") && !sig.startsWith("data:image/jpeg")) {
    return { ok: false, error: "La firma debe ser una imagen PNG o JPEG." };
  }
  const base64 = sig.split(",")[1] ?? "";
  const bytes = Math.ceil((base64.length * 3) / 4);
  if (bytes > MAX_SIGNATURE_BYTES) {
    return { ok: false, error: "La firma es demasiado grande." };
  }
  return { ok: true };
}

/** Elimina mediciones vacías/nulas (el formulario técnico es opcional). */
function sanitizeMeasurements(m?: Measurements | null): Measurements | null {
  if (!m) return null;
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(m)) {
    if (value != null && !Number.isNaN(Number(value))) out[key] = Number(value);
  }
  return Object.keys(out).length ? out : null;
}

function normalizeMaterials(materials: MaterialInput[]) {
  return materials
    .filter((m) => m.description.trim().length > 0)
    .map((m) => {
      const quantity = Number(m.quantity) || 0;
      const unitCost = Number(m.unitCost) || 0;
      return {
        description: m.description.trim(),
        quantity,
        unit_cost: unitCost,
        subtotal: Math.round(quantity * unitCost * 100) / 100,
      };
    });
}

async function logAccessAudit(
  admin: SupabaseClient,
  equipmentId: string,
  userId: string,
  action: "edit_attempt" | "edit_success",
) {
  await admin.from("qr_access_audit").insert({
    equipment_id: equipmentId,
    actor_type: "user",
    user_id: userId,
    action,
    ip_hash: null,
  });
}

export async function createWorkOrder(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canCreate: boolean;
  input: WorkOrderInput;
}): Promise<WorkOrderResult> {
  if (!args.canCreate) {
    await logAccessAudit(args.admin, args.input.equipmentId, args.actorUserId, "edit_attempt");
    return { ok: false, error: "No tenés permiso para crear órdenes de trabajo." };
  }
  const { admin, company, actorUserId, input } = args;

  if (!VISIT_TYPES.includes(input.visitType as never)) {
    return { ok: false, error: "Tipo de visita inválido." };
  }
  const sig = validateSignature(input.signatureImage);
  if (!sig.ok) return { ok: false, error: sig.error };

  const { data: equipment } = await admin
    .from("equipment")
    .select("id")
    .eq("id", input.equipmentId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!equipment) return { ok: false, error: "Equipo no encontrado." };

  if (input.appointmentId) {
    const { data: appointment } = await admin
      .from("appointments")
      .select("id")
      .eq("id", input.appointmentId)
      .eq("company_id", company.id)
      .maybeSingle();
    if (!appointment) return { ok: false, error: "Turno no encontrado." };
  }

  const { data: workOrder, error } = await admin
    .from("work_orders")
    .insert({
      company_id: company.id,
      appointment_id: input.appointmentId ?? null,
      equipment_id: input.equipmentId,
      service_request_id: input.serviceRequestId ?? null,
      created_by: actorUserId,
      visit_type: input.visitType,
      diagnosis_notes: input.diagnosisNotes?.trim() || null,
      measurements: sanitizeMeasurements(input.measurements),
      fault_found: input.faultFound?.trim() || null,
      signature_image: input.signatureImage ?? null,
      warranty_days: input.warrantyDays ?? null,
      status: "borrador",
    })
    .select("id")
    .single();
  if (error || !workOrder) return { ok: false, error: "No se pudo crear la orden de trabajo." };

  const materials = normalizeMaterials(input.materials);
  if (materials.length) {
    await admin.from("work_order_materials").insert(
      materials.map((m) => ({ work_order_id: workOrder.id, ...m })),
    );
  }

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "work_orders.create",
    entityType: "work_orders",
    entityId: workOrder.id,
    newData: { equipmentId: input.equipmentId, visitType: input.visitType },
  });
  await logAccessAudit(admin, input.equipmentId, actorUserId, "edit_success");

  return { ok: true, workOrderId: workOrder.id };
}

export async function startWorkOrder(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canUpdate: boolean;
  workOrderId: string;
}): Promise<ServiceResult> {
  if (!args.canUpdate) return { ok: false, error: "No autorizado." };
  const { admin, company, actorUserId, workOrderId } = args;

  const { data: existing } = await admin
    .from("work_orders")
    .select("status, actual_start_at")
    .eq("id", workOrderId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Orden de trabajo no encontrada." };
  if (existing.status !== "borrador") {
    return { ok: false, error: "Solo se puede iniciar una orden en borrador." };
  }

  const { error } = await admin
    .from("work_orders")
    .update({ status: "en_progreso", actual_start_at: new Date().toISOString() })
    .eq("id", workOrderId);
  if (error) return { ok: false, error: "No se pudo iniciar la visita." };

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "work_orders.start",
    entityType: "work_orders",
    entityId: workOrderId,
  });

  return { ok: true };
}

export async function finishWorkOrder(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canUpdate: boolean;
  workOrderId: string;
}): Promise<ServiceResult> {
  if (!args.canUpdate) return { ok: false, error: "No autorizado." };
  const { admin, company, actorUserId, workOrderId } = args;

  const { data: existing } = await admin
    .from("work_orders")
    .select("id, status, warranty_days, equipment_id, service_request_id")
    .eq("id", workOrderId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Orden de trabajo no encontrada." };
  if (existing.status !== "en_progreso") {
    return { ok: false, error: "La visita debe estar en curso para finalizarla." };
  }

  const now = new Date();
  const warrantyUntil = existing.warranty_days
    ? new Date(now.getTime() + existing.warranty_days * 86400000)
    : null;

  // Si la orden de trabajo tiene un service_request_id, buscar quote asociado y crear account_charge automático
  if (existing.service_request_id) {
    const { data: quote } = await admin
      .from("quotes")
      .select("id, total")
      .eq("service_request_id", existing.service_request_id)
      .eq("status", "aceptado")
      .maybeSingle();

    if (quote) {
      // Obtener client_id del work_order
      const { data: woClient } = await admin
        .from("work_orders")
        .select("client_id")
        .eq("id", existing.id)
        .single();

      const { data: charge, error: chargeError } = await admin
        .from("account_charges")
        .insert({
          company_id: company.id,
          client_id: (await admin
            .from("work_orders")
            .select("client_id")
            .eq("id", existing.id)
            .single()).data?.client_id,
          related_work_order_id: existing.id,
          service_request_id: existing.service_request_id,
          description: `Orden de trabajo finalizada #${workOrderId.slice(0, 8)}`,
          amount: quote.total,
          due_date: new Date().toISOString().slice(0, 10),
          status: "pendiente",
        })
        .select("id")
        .single();

      if (!chargeError) {
        await writeAuditLog(admin, {
          companyId: company.id,
          userId: actorUserId,
          action: "account_charges.create_from_work_order",
          entityType: "account_charges",
          entityId: charge.id,
          newData: { workOrderId, quoteTotal: quote.total },
        });
      }
    }
  }

  const { error } = await admin
    .from("work_orders")
    .update({
      status: "completado",
      actual_end_at: now.toISOString(),
      warranty_until: warrantyUntil ? warrantyUntil.toISOString().slice(0, 10) : null,
    })
    .eq("id", workOrderId);
  if (error) return { ok: false, error: "No se pudo finalizar la visita." };

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "work_orders.finish",
    entityType: "work_orders",
    entityId: workOrderId,
    newData: { warranty_until: warrantyUntil ? warrantyUntil.toISOString().slice(0, 10) : null },
  });

  return { ok: true };
}