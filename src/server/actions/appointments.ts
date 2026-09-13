"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission, requireUser } from "@/server/auth";
import {
  createAppointment,
  deleteAppointment,
  updateAppointment,
  updateAppointmentStatus,
  type AppointmentInput,
} from "@/server/services/appointments";

export type AppointmentFormState = { error?: string };

const appointmentSchema = z.object({
  clientId: z.string().uuid("Cliente inválido"),
  equipmentId: z.string().uuid().optional().nullable(),
  serviceRequestId: z.string().uuid().optional().nullable(),
  appointmentType: z.string().min(1, "Tipo de cita requerido"),
  scheduledAt: z.string().min(1, "Fecha requerida"),
  estimatedDuration: z.coerce.number().int().positive().optional().nullable(),
  notes: z.string().optional(),
  technicianIds: z.array(z.string().uuid()),
});

function parseInput(
  formData: FormData,
): { ok: true; data: AppointmentInput } | { ok: false; error: string } {
  let technicianIds: unknown = [];
  try {
    technicianIds = JSON.parse(String(formData.get("technicianIds") ?? "[]"));
  } catch {
    return { ok: false, error: "Datos inválidos." };
  }
  const parsed = appointmentSchema.safeParse({
    clientId: formData.get("clientId"),
    equipmentId: formData.get("equipmentId") || null,
    serviceRequestId: formData.get("serviceRequestId") || null,
    appointmentType: formData.get("appointmentType"),
    scheduledAt: formData.get("scheduledAt"),
    estimatedDuration: formData.get("estimatedDuration") || null,
    notes: formData.get("notes") || undefined,
    technicianIds,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  return { ok: true, data: parsed.data };
}

export async function saveAppointmentAction(
  _prev: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) return { error: "No autorizado." };

  const appointmentId = String(formData.get("appointmentId") ?? "");
  const parsed = parseInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const admin = createAdminClient();
  const company = { id: user.companyId };

  if (appointmentId) {
    const result = await updateAppointment({
      admin,
      company,
      actorUserId: user.id,
      canUpdate: await hasPermission(user, "appointments.update"),
      appointmentId,
      input: parsed.data,
    });
    if (!result.ok) return { error: result.error };
    revalidatePath("/agenda");
    redirect("/agenda");
  }

  const result = await createAppointment({
    admin,
    company,
    actorUserId: user.id,
    canCreate: await hasPermission(user, "appointments.create"),
    input: parsed.data,
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/agenda");
  redirect("/agenda");
}

export async function updateAppointmentStatusAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/agenda");

  const appointmentId = String(formData.get("appointmentId") ?? "");
  const status = String(formData.get("status") ?? "");

  const admin = createAdminClient();
  await updateAppointmentStatus({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    canUpdate: await hasPermission(user, "appointments.update"),
    appointmentId,
    status,
  });

  revalidatePath("/agenda");
  redirect("/agenda");
}

export async function deleteAppointmentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/agenda");

  const appointmentId = String(formData.get("appointmentId") ?? "");
  const admin = createAdminClient();
  await deleteAppointment({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    canDelete: await hasPermission(user, "appointments.delete"),
    appointmentId,
  });

  revalidatePath("/agenda");
  redirect("/agenda");
}
