"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission, requireUser } from "@/server/auth";
import {
  createWorkOrder,
  finishWorkOrder,
  startWorkOrder,
  type WorkOrderInput,
} from "@/server/services/work-orders";

export type WorkOrderFormState = { error?: string };

const measurementsSchema = z.object({
  presion_baja: z.number().nullable().optional(),
  presion_alta: z.number().nullable().optional(),
  temp_retorno: z.number().nullable().optional(),
  temp_impulsion: z.number().nullable().optional(),
  amperaje: z.number().nullable().optional(),
  tension: z.number().nullable().optional(),
  superheat: z.number().nullable().optional(),
  subcooling: z.number().nullable().optional(),
});

const materialSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitCost: z.number(),
});

const schema = z.object({
  equipmentId: z.string().uuid("Equipo inválido"),
  appointmentId: z.string().uuid().optional().nullable(),
  visitType: z.string().min(1, "Tipo de visita requerido"),
  diagnosisNotes: z.string().optional(),
  measurements: measurementsSchema.nullable().optional(),
  faultFound: z.string().optional(),
  signatureImage: z.string().optional().nullable(),
  materials: z.array(materialSchema),
  warrantyDays: z.number().int().min(0).nullable().optional(),
});

function parseInput(
  formData: FormData,
): { ok: true; data: WorkOrderInput } | { ok: false; error: string } {
  let materials: unknown = [];
  let measurements: unknown = null;
  try {
    materials = JSON.parse(String(formData.get("materials") ?? "[]"));
    const rawM = String(formData.get("measurements") ?? "");
    measurements = rawM ? JSON.parse(rawM) : null;
  } catch {
    return { ok: false, error: "Datos inválidos." };
  }

  const parsed = schema.safeParse({
    equipmentId: formData.get("equipmentId"),
    appointmentId: formData.get("appointmentId") || null,
    visitType: formData.get("visitType"),
    diagnosisNotes: formData.get("diagnosisNotes") || undefined,
    measurements,
    faultFound: formData.get("faultFound") || undefined,
    signatureImage: formData.get("signatureImage") || null,
    materials,
    warrantyDays: formData.get("warrantyDays") ? Number(formData.get("warrantyDays")) : null,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  return { ok: true, data: parsed.data as WorkOrderInput };
}

export async function saveWorkOrderAction(
  _prev: WorkOrderFormState,
  formData: FormData,
): Promise<WorkOrderFormState> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) return { error: "No autorizado." };

  const parsed = parseInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const admin = createAdminClient();
  const result = await createWorkOrder({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    canCreate: await hasPermission(user, "work_orders.create"),
    input: parsed.data,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/ordenes");
  redirect(`/ordenes/${result.workOrderId}`);
}

export async function startWorkOrderAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/ordenes");

  const workOrderId = String(formData.get("workOrderId") ?? "");
  const admin = createAdminClient();
  await startWorkOrder({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    canUpdate: await hasPermission(user, "work_orders.update"),
    workOrderId,
  });

  revalidatePath("/ordenes");
  redirect(`/ordenes/${workOrderId}`);
}

export async function finishWorkOrderAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/ordenes");

  const workOrderId = String(formData.get("workOrderId") ?? "");
  const admin = createAdminClient();
  await finishWorkOrder({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    canUpdate: await hasPermission(user, "work_orders.update"),
    workOrderId,
  });

  revalidatePath("/ordenes");
  redirect(`/ordenes/${workOrderId}`);
}
