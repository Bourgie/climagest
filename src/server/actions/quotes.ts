"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission, requireUser } from "@/server/auth";
import {
  createQuote,
  deleteQuote,
  respondToQuoteInternal,
  sendQuote,
  updateQuote,
  type QuoteInput,
} from "@/server/services/quotes";

export type QuoteFormState = { error?: string; success?: boolean; token?: string };

const quoteItemSchema = z.object({
  description: z.string(),
  type: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
});
const quoteSchema = z.object({
  serviceRequestId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid("Cliente inválido"),
  equipmentId: z.string().uuid().optional().nullable(),
  items: z.array(quoteItemSchema),
  discount: z.number(),
  paymentTerms: z.string().optional(),
  validUntil: z.string().optional(),
});

function parseInput(
  formData: FormData,
): { ok: true; data: QuoteInput } | { ok: false; error: string } {
  let items: unknown = [];
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { ok: false, error: "Datos inválidos." };
  }
  const parsed = quoteSchema.safeParse({
    serviceRequestId: formData.get("serviceRequestId") || null,
    clientId: formData.get("clientId"),
    equipmentId: formData.get("equipmentId") || null,
    items,
    discount: Number(formData.get("discount") ?? 0),
    paymentTerms: formData.get("paymentTerms") || undefined,
    validUntil: formData.get("validUntil") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  return { ok: true, data: parsed.data };
}

export async function saveQuoteAction(
  _prev: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) return { error: "No autorizado." };

  const quoteId = String(formData.get("quoteId") ?? "");
  const parsed = parseInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const admin = createAdminClient();
  const company = { id: user.companyId };

  if (quoteId) {
    const result = await updateQuote({
      admin,
      company,
      actorUserId: user.id,
      canUpdate: await hasPermission(user, "quotes.update"),
      quoteId,
      input: parsed.data,
    });
    if (!result.ok) return { error: result.error };
    revalidatePath("/presupuestos");
    redirect(`/presupuestos/${quoteId}`);
  }

  const result = await createQuote({
    admin,
    company,
    actorUserId: user.id,
    canCreate: await hasPermission(user, "quotes.create"),
    input: parsed.data,
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/presupuestos");
  redirect(`/presupuestos/${result.quoteId}`);
}

export async function sendQuoteAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/presupuestos");

  const quoteId = String(formData.get("quoteId") ?? "");
  const admin = createAdminClient();
  await sendQuote({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    canSend: await hasPermission(user, "quotes.send"),
    quoteId,
  });

  revalidatePath("/presupuestos");
  redirect(`/presupuestos/${quoteId}`);
}

export async function respondQuoteAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/presupuestos");

  const quoteId = String(formData.get("quoteId") ?? "");
  const accept = formData.get("accept") === "true";

  const admin = createAdminClient();
  await respondToQuoteInternal({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    canUpdate: await hasPermission(user, "quotes.update"),
    quoteId,
    accept,
  });

  revalidatePath("/presupuestos");
  redirect(`/presupuestos/${quoteId}`);
}

export async function deleteQuoteAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/presupuestos");

  const quoteId = String(formData.get("quoteId") ?? "");
  const admin = createAdminClient();
  await deleteQuote({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    canDelete: await hasPermission(user, "quotes.delete"),
    quoteId,
  });

  revalidatePath("/presupuestos");
  redirect("/presupuestos");
}
