"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { respondToQuoteByToken } from "@/server/services/quotes";

export type QuoteAcceptanceState = { error?: string; success?: boolean };

/** Acción pública: aceptar o rechazar un presupuesto por link (token). */
export async function respondToQuoteByTokenAction(
  _prev: QuoteAcceptanceState,
  formData: FormData,
): Promise<QuoteAcceptanceState> {
  const token = String(formData.get("token") ?? "");
  const accept = formData.get("accept") === "true";

  const admin = createAdminClient();
  const result = await respondToQuoteByToken({ admin, token, accept });

  if (!result.ok) return { error: result.error };
  revalidatePath(`/presupuesto/${token}`);
  return { success: true };
}
