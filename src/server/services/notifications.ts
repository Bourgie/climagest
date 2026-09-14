"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/server/auth";

type NotificationPayload = {
  companyId: string;
  type: "turno_manana" | "presupuesto_pendiente" | "pago_vencido" | "consulta_qr" | "turno_asignado" | "garantia" | "mantenimiento_proximo";
  title: string;
  body?: string;
  targetRole?: "owner" | "admin" | "technician";
  recipientUserId?: string;
  relatedTable?: string;
  relatedId?: string;
};

export async function emitNotification(payload: NotificationPayload): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert({
    company_id: payload.companyId,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    target_role: payload.targetRole ?? null,
    recipient_user_id: payload.recipientUserId ?? null,
    related_table: payload.relatedTable ?? null,
    related_id: payload.relatedId ?? null,
  });
  if (error) {
    // No romper el flujo principal si falla la notificación
    console.error("[notification] emit failed:", error.message);
  }
}

// Helpers para eventos comunes del flujo (para llamar desde servicios/actions)
export async function notifyNewAppointment(args: {
  admin: ReturnType<typeof createAdminClient>;
  companyId: string;
  appointmentId: string;
  technicianIds: string[];
  clientName: string;
  scheduledAt: string;
}): Promise<void> {
  const { technicianIds, companyId, appointmentId, clientName, scheduledAt } = args;
  for (const tid of technicianIds) {
    await emitNotification({
      companyId,
      type: "turno_asignado",
      title: "Nuevo turno asignado",
      body: `${clientName} — ${new Date(scheduledAt).toLocaleString("es-AR")}`,
      targetRole: "technician",
      recipientUserId: tid,
      relatedTable: "appointments",
      relatedId: appointmentId,
    });
  }
}

export async function notifyQuotePending(args: {
  admin: ReturnType<typeof createAdminClient>;
  companyId: string;
  quoteId: string;
  clientName: string;
}): Promise<void> {
  await emitNotification({
    companyId: args.companyId,
    type: "presupuesto_pendiente",
    title: "Presupuesto pendiente",
    body: `Esperando respuesta de ${args.clientName}`,
    targetRole: "owner",
    relatedTable: "quotes",
    relatedId: args.quoteId,
  });
  await emitNotification({
    companyId: args.companyId,
    type: "presupuesto_pendiente",
    title: "Presupuesto pendiente",
    body: `Esperando respuesta de ${args.clientName}`,
    targetRole: "admin",
    relatedTable: "quotes",
    relatedId: args.quoteId,
  });
}

export async function notifyPaymentOverdue(args: {
  admin: ReturnType<typeof createAdminClient>;
  companyId: string;
  clientName: string;
  amount: number;
}): Promise<void> {
  await emitNotification({
    companyId: args.companyId,
    type: "pago_vencido",
    title: "Pago vencido",
    body: `${args.clientName} — $${args.amount.toFixed(2)}`,
    targetRole: "owner",
  });
  await emitNotification({
    companyId: args.companyId,
    type: "pago_vencido",
    title: "Pago vencido",
    body: `${args.clientName} — $${args.amount.toFixed(2)}`,
    targetRole: "admin",
  });
}

export async function notifyQrInquiry(args: {
  admin: ReturnType<typeof createAdminClient>;
  companyId: string;
  equipmentBrand: string;
  equipmentModel: string;
}): Promise<void> {
  await emitNotification({
    companyId: args.companyId,
    type: "consulta_qr",
    title: "Nueva consulta desde QR",
    body: `${args.equipmentBrand} ${args.equipmentModel}`,
    targetRole: "owner",
  });
  await emitNotification({
    companyId: args.companyId,
    type: "consulta_qr",
    title: "Nueva consulta desde QR",
    body: `${args.equipmentBrand} ${args.equipmentModel}`,
    targetRole: "admin",
  });
}

export async function notifyWarranty(args: {
  admin: ReturnType<typeof createAdminClient>;
  companyId: string;
  equipmentBrand: string;
  equipmentModel: string;
  clientName: string;
}): Promise<void> {
  await emitNotification({
    companyId: args.companyId,
    type: "garantia",
    title: "⚠️ Garantía vigente",
    body: `${args.clientName} — ${args.equipmentBrand} ${args.equipmentModel} tiene trabajo en garantía`,
    targetRole: "owner",
  });
  await emitNotification({
    companyId: args.companyId,
    type: "garantia",
    title: "⚠️ Garantía vigente",
    body: `${args.clientName} — ${args.equipmentBrand} ${args.equipmentModel} tiene trabajo en garantía`,
    targetRole: "admin",
  });
}

export async function notifyUpcomingMaintenance(args: {
  admin: ReturnType<typeof createAdminClient>;
  companyId: string;
  equipmentId: string;
  equipmentBrand: string;
  equipmentModel: string;
  nextDate: string;
}): Promise<void> {
  await emitNotification({
    companyId: args.companyId,
    type: "mantenimiento_proximo",
    title: "Mantenimiento próximo",
    body: `${args.equipmentBrand} ${args.equipmentModel} — vence ${args.nextDate}`,
    targetRole: "owner",
  });
  await emitNotification({
    companyId: args.companyId,
    type: "mantenimiento_proximo",
    title: "Mantenimiento próximo",
    body: `${args.equipmentBrand} ${args.equipmentModel} — vence ${args.nextDate}`,
    targetRole: "admin",
  });
}