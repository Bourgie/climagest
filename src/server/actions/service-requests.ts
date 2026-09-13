"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission, requireUser } from "@/server/auth";
import {
  createServiceRequest,
  createServiceRequestFromQr,
  updateServiceRequestStatus,
} from "@/server/services/service-requests";

export type ServiceRequestFormState = { error?: string; success?: boolean };

const createSchema = z.object({
  clientId: z.string().uuid("Cliente inválido"),
  equipmentId: z.string().uuid().optional().nullable(),
  origin: z.string(),
  description: z.string().optional(),
});

export async function createServiceRequestAction(
  _prev: ServiceRequestFormState,
  formData: FormData,
): Promise<ServiceRequestFormState> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) return { error: "No autorizado." };

  const parsed = createSchema.safeParse({
    clientId: formData.get("clientId"),
    equipmentId: formData.get("equipmentId") || null,
    origin: formData.get("origin"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const admin = createAdminClient();
  const result = await createServiceRequest({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    canCreate: await hasPermission(user, "service_requests.create"),
    input: parsed.data,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/pedidos");
  redirect("/pedidos");
}

export async function updateServiceRequestStatusAction(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/pedidos");

  const requestId = String(formData.get("requestId") ?? "");
  const status = String(formData.get("status") ?? "");

  const admin = createAdminClient();
  await updateServiceRequestStatus({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    canUpdate: await hasPermission(user, "service_requests.update"),
    requestId,
    status,
  });

  revalidatePath("/pedidos");
  redirect("/pedidos");
}

export type QrRequestState = { error?: string; success?: boolean };

/** Acción pública: "Solicitar servicio" desde el QR crea un pedido (origin=qr_publico). */
export async function requestServiceFromQrAction(
  _prev: QrRequestState,
  formData: FormData,
): Promise<QrRequestState> {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "");
  const contact = String(formData.get("contact") ?? "");
  const message = String(formData.get("message") ?? "");

  const admin = createAdminClient();
  const result = await createServiceRequestFromQr({
    admin,
    token,
    visitorName: name,
    visitorContact: contact,
    message,
  });

  if (!result.ok) return { error: result.error };
  return { success: true };
}
