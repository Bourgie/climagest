"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission, requireUser } from "@/server/auth";
import {
  createEquipment,
  deleteEquipment,
  updateEquipment,
  type EquipmentInput,
} from "@/server/services/equipment";

const equipmentSchema = z.object({
  clientId: z.string().uuid("Cliente inválido"),
  addressId: z.string().uuid().optional().nullable(),
  equipmentType: z.string().min(1, "Tipo requerido"),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  btu: z.coerce.number().int().positive().optional().nullable(),
  power: z.string().optional(),
  refrigerantType: z.string().optional(),
  installDate: z.string().optional(),
  warrantyUntil: z.string().optional(),
  conditionStatus: z.string().optional(),
  locationLabel: z.string().optional(),
});

export type EquipmentFormState = { error?: string };

function parseInput(
  formData: FormData,
): { ok: true; data: EquipmentInput } | { ok: false; error: string } {
  const parsed = equipmentSchema.safeParse({
    clientId: formData.get("clientId"),
    addressId: formData.get("addressId") || null,
    equipmentType: formData.get("equipmentType"),
    brand: formData.get("brand") || undefined,
    model: formData.get("model") || undefined,
    serialNumber: formData.get("serialNumber") || undefined,
    btu: formData.get("btu") || null,
    power: formData.get("power") || undefined,
    refrigerantType: formData.get("refrigerantType") || undefined,
    installDate: formData.get("installDate") || undefined,
    warrantyUntil: formData.get("warrantyUntil") || undefined,
    conditionStatus: formData.get("conditionStatus") || undefined,
    locationLabel: formData.get("locationLabel") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  return { ok: true, data: parsed.data };
}

export async function saveEquipmentAction(
  _prev: EquipmentFormState,
  formData: FormData,
): Promise<EquipmentFormState> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) return { error: "No autorizado." };

  const equipmentId = String(formData.get("equipmentId") ?? "");
  const parsed = parseInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const admin = createAdminClient();
  const company = { id: user.companyId };

  if (equipmentId) {
    const result = await updateEquipment({
      admin,
      company,
      actorUserId: user.id,
      canUpdate: await hasPermission(user, "equipment.update"),
      equipmentId,
      input: parsed.data,
    });
    if (!result.ok) return { error: result.error };
    revalidatePath("/equipos");
    redirect(`/equipos/${equipmentId}`);
  }

  const result = await createEquipment({
    admin,
    company,
    actorUserId: user.id,
    canCreate: await hasPermission(user, "equipment.create"),
    input: parsed.data,
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/equipos");
  redirect(`/equipos/${result.equipmentId}`);
}

export async function deleteEquipmentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/equipos");

  const equipmentId = String(formData.get("equipmentId") ?? "");
  const admin = createAdminClient();
  await deleteEquipment({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    canDelete: await hasPermission(user, "equipment.delete"),
    equipmentId,
  });

  revalidatePath("/equipos");
  redirect("/equipos");
}
