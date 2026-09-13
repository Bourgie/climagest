"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { submitInquiry } from "@/server/services/inquiries";

export type InquiryState = { error?: string; success?: boolean };

/**
 * Acción pública: un visitante (sin cuenta) deja una consulta sobre un equipo
 * escaneado por QR. Resuelve el equipo por qr_token server-side.
 */
export async function submitInquiryAction(
  _prev: InquiryState,
  formData: FormData,
): Promise<InquiryState> {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "");
  const contact = String(formData.get("contact") ?? "");
  const message = String(formData.get("message") ?? "");

  const admin = createAdminClient();
  const result = await submitInquiry({
    admin,
    token,
    visitorName: name,
    visitorContact: contact,
    message,
  });

  if (!result.ok) return { error: result.error };
  return { success: true };
}
