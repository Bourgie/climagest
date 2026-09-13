import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceResult } from "./types";

/**
 * Consulta de un visitante anónimo (o de otra empresa) a un equipo vía QR.
 * Resuelve el equipo por qr_token y persiste la consulta. No crea cuenta ni
 * sesión. Visible para Dueño/Administrativo de la empresa dueña del equipo.
 */
export async function submitInquiry(args: {
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
    .select("id")
    .eq("qr_token", args.token)
    .maybeSingle();
  if (!equipment) return { ok: false, error: "Equipo no encontrado." };

  const { error } = await args.admin.from("qr_inquiries").insert({
    equipment_id: equipment.id,
    visitor_name: name,
    visitor_contact: contact,
    message: args.message?.trim() || null,
    status: "nuevo",
  });
  if (error) return { ok: false, error: "No se pudo enviar la consulta." };

  return { ok: true };
}
