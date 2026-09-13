import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EQUIPMENT_TYPES } from "@/lib/equipment-types";
import { writeAuditLog } from "./audit";
import type { ServiceResult } from "./types";

export type EquipmentInput = {
  clientId: string;
  addressId?: string | null;
  equipmentType: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  btu?: number | null;
  power?: string;
  refrigerantType?: string;
  installDate?: string | null;
  warrantyUntil?: string | null;
  conditionStatus?: string;
  locationLabel?: string;
};

export type EquipmentResult =
  | { ok: true; equipmentId: string; qrToken: string }
  | { ok: false; error: string };

/** qr_token con entropía criptográfica (192 bits), no adivinable ni secuencial. */
function generateQrToken(): string {
  return randomBytes(24).toString("base64url");
}

async function validateClientAndAddress(
  admin: SupabaseClient,
  companyId: string,
  input: EquipmentInput,
): Promise<{ clientOk: boolean; error?: string }> {
  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("id", input.clientId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!client) return { clientOk: false, error: "Cliente no encontrado." };

  if (input.addressId) {
    const { data: address } = await admin
      .from("client_addresses")
      .select("id")
      .eq("id", input.addressId)
      .eq("client_id", input.clientId)
      .maybeSingle();
    if (!address) return { clientOk: false, error: "Dirección no encontrada." };
  }

  return { clientOk: true };
}

export async function createEquipment(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canCreate: boolean;
  input: EquipmentInput;
}): Promise<EquipmentResult> {
  if (!args.canCreate) {
    return { ok: false, error: "No tenés permiso para crear equipos." };
  }

  const { admin, company, actorUserId, input } = args;
  if (!EQUIPMENT_TYPES.includes(input.equipmentType as never)) {
    return { ok: false, error: "Tipo de equipo inválido." };
  }

  const valid = await validateClientAndAddress(admin, company.id, input);
  if (!valid.clientOk) return { ok: false, error: valid.error ?? "Datos inválidos." };

  const qrToken = generateQrToken();
  const { data: equipment, error } = await admin
    .from("equipment")
    .insert({
      company_id: company.id,
      client_id: input.clientId,
      address_id: input.addressId ?? null,
      equipment_type: input.equipmentType,
      brand: input.brand?.trim() || null,
      model: input.model?.trim() || null,
      serial_number: input.serialNumber?.trim() || null,
      btu: input.btu ?? null,
      power: input.power?.trim() || null,
      refrigerant_type: input.refrigerantType?.trim() || null,
      install_date: input.installDate || null,
      warranty_until: input.warrantyUntil || null,
      condition_status: input.conditionStatus?.trim() || null,
      location_label: input.locationLabel?.trim() || null,
      qr_token: qrToken,
    })
    .select("id")
    .single();

  if (error || !equipment) return { ok: false, error: "No se pudo crear el equipo." };

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "equipment.create",
    entityType: "equipment",
    entityId: equipment.id,
    newData: { brand: input.brand, model: input.model },
  });

  return { ok: true, equipmentId: equipment.id, qrToken };
}

export async function updateEquipment(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canUpdate: boolean;
  equipmentId: string;
  input: EquipmentInput;
}): Promise<ServiceResult> {
  if (!args.canUpdate) return { ok: false, error: "No autorizado." };
  const { admin, company, actorUserId, equipmentId, input } = args;

  if (!EQUIPMENT_TYPES.includes(input.equipmentType as never)) {
    return { ok: false, error: "Tipo de equipo inválido." };
  }

  const { data: existing } = await admin
    .from("equipment")
    .select("id")
    .eq("id", equipmentId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Equipo no encontrado." };

  const valid = await validateClientAndAddress(admin, company.id, input);
  if (!valid.clientOk) return { ok: false, error: valid.error ?? "Datos inválidos." };

  const { error } = await admin
    .from("equipment")
    .update({
      client_id: input.clientId,
      address_id: input.addressId ?? null,
      equipment_type: input.equipmentType,
      brand: input.brand?.trim() || null,
      model: input.model?.trim() || null,
      serial_number: input.serialNumber?.trim() || null,
      btu: input.btu ?? null,
      power: input.power?.trim() || null,
      refrigerant_type: input.refrigerantType?.trim() || null,
      install_date: input.installDate || null,
      warranty_until: input.warrantyUntil || null,
      condition_status: input.conditionStatus?.trim() || null,
      location_label: input.locationLabel?.trim() || null,
    })
    .eq("id", equipmentId);
  if (error) return { ok: false, error: "No se pudo actualizar el equipo." };

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "equipment.update",
    entityType: "equipment",
    entityId: equipmentId,
    newData: { brand: input.brand, model: input.model },
  });

  return { ok: true };
}

export async function deleteEquipment(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canDelete: boolean;
  equipmentId: string;
}): Promise<ServiceResult> {
  if (!args.canDelete) {
    return { ok: false, error: "No tenés permiso para eliminar equipos." };
  }
  const { admin, company, actorUserId, equipmentId } = args;

  const { data: existing } = await admin
    .from("equipment")
    .select("id")
    .eq("id", equipmentId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Equipo no encontrado." };

  await admin.from("equipment").delete().eq("id", equipmentId);

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "equipment.delete",
    entityType: "equipment",
    entityId: equipmentId,
  });

  return { ok: true };
}
