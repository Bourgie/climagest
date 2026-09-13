import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "./audit";
import type { ServiceResult } from "./types";

export const QUOTE_STATUSES = ["draft", "enviado", "aceptado", "rechazado", "vencido"] as const;
export const QUOTE_ITEM_TYPES = ["mano_obra", "material", "repuesto"] as const;

export type QuoteItemInput = {
  description: string;
  type: string;
  quantity: number;
  unitPrice: number;
};

export type QuoteInput = {
  serviceRequestId?: string | null;
  clientId: string;
  equipmentId?: string | null;
  items: QuoteItemInput[];
  discount: number;
  paymentTerms?: string;
  validUntil?: string | null;
};

export type QuoteResult = { ok: true; quoteId: string } | { ok: false; error: string };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Calcula subtotales de items, labor total, subtotal del quote y total. */
function computeTotals(items: QuoteItemInput[], discount: number) {
  let subtotal = 0;
  let labor = 0;
  const computed = items.map((item) => {
    const q = Number(item.quantity) || 0;
    const p = Number(item.unitPrice) || 0;
    const sub = round2(q * p);
    if (item.type === "mano_obra") labor += sub;
    subtotal += sub;
    return { quantity: q, unitPrice: p, subtotal: sub };
  });
  const disc = Number(discount) || 0;
  return {
    computed,
    subtotal: round2(subtotal),
    laborAmount: round2(labor),
    total: round2(subtotal - disc),
  };
}

function normalizeItems(items: QuoteItemInput[]): { ok: true; items: QuoteItemInput[] } | { ok: false; error: string } {
  if (!items.length) return { ok: false, error: "Agregá al menos una línea al presupuesto." };
  for (const it of items) {
    if (!QUOTE_ITEM_TYPES.includes(it.type as never)) return { ok: false, error: "Tipo de línea inválido." };
    if (!it.description.trim()) return { ok: false, error: "Cada línea necesita una descripción." };
    if (Number(it.quantity) <= 0) return { ok: false, error: "La cantidad debe ser mayor a 0." };
  }
  return {
    ok: true,
    items: items.map((it) => ({
      description: it.description.trim(),
      type: it.type,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice) || 0,
    })),
  };
}

async function validateRefs(
  admin: SupabaseClient,
  companyId: string,
  input: QuoteInput,
): Promise<{ ok: false; error: string } | { ok: true; requestId?: string }> {
  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("id", input.clientId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!client) return { ok: false, error: "Cliente no encontrado." };

  if (input.equipmentId) {
    const { data: equipment } = await admin
      .from("equipment")
      .select("id")
      .eq("id", input.equipmentId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!equipment) return { ok: false, error: "Equipo no encontrado." };
  }

  if (input.serviceRequestId) {
    const { data: sr } = await admin
      .from("service_requests")
      .select("id")
      .eq("id", input.serviceRequestId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!sr) return { ok: false, error: "Pedido no encontrado." };
    return { ok: true, requestId: sr.id };
  }

  return { ok: true };
}

async function insertItems(admin: SupabaseClient, quoteId: string, items: QuoteItemInput[]) {
  const { computed } = computeTotals(items, 0);
  await admin.from("quote_items").insert(
    computed.map((c, i) => ({
      quote_id: quoteId,
      description: items[i].description,
      type: items[i].type,
      quantity: c.quantity,
      unit_price: c.unitPrice,
      subtotal: c.subtotal,
    })),
  );
}

export async function createQuote(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canCreate: boolean;
  input: QuoteInput;
}): Promise<QuoteResult> {
  if (!args.canCreate) return { ok: false, error: "No tenés permiso para crear presupuestos." };
  const { admin, company, actorUserId, input } = args;

  const normalized = normalizeItems(input.items);
  if (!normalized.ok) return { ok: false, error: normalized.error };

  const refs = await validateRefs(admin, company.id, input);
  if (!refs.ok) return { ok: false, error: refs.error };

  const totals = computeTotals(normalized.items, input.discount);

  const { data: quote, error } = await admin
    .from("quotes")
    .insert({
      company_id: company.id,
      service_request_id: input.serviceRequestId ?? null,
      client_id: input.clientId,
      equipment_id: input.equipmentId ?? null,
      labor_amount: totals.laborAmount,
      discount: Number(input.discount) || 0,
      subtotal: totals.subtotal,
      total: totals.total,
      payment_terms: input.paymentTerms?.trim() || null,
      valid_until: input.validUntil || null,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !quote) return { ok: false, error: "No se pudo crear el presupuesto." };

  await insertItems(admin, quote.id, normalized.items);

  // Si viene de un pedido, marcarlo como presupuestado.
  if (input.serviceRequestId) {
    await admin
      .from("service_requests")
      .update({ status: "presupuestado" })
      .eq("id", input.serviceRequestId);
  }

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "quotes.create",
    entityType: "quotes",
    entityId: quote.id,
    newData: { total: totals.total },
  });

  return { ok: true, quoteId: quote.id };
}

export async function updateQuote(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canUpdate: boolean;
  quoteId: string;
  input: QuoteInput;
}): Promise<ServiceResult> {
  if (!args.canUpdate) return { ok: false, error: "No autorizado." };
  const { admin, company, actorUserId, quoteId, input } = args;

  const { data: existing } = await admin
    .from("quotes")
    .select("status")
    .eq("id", quoteId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Presupuesto no encontrado." };
  if (existing.status !== "draft") {
    return { ok: false, error: "Solo se puede editar un presupuesto en borrador." };
  }

  const normalized = normalizeItems(input.items);
  if (!normalized.ok) return { ok: false, error: normalized.error };
  const refs = await validateRefs(admin, company.id, input);
  if (!refs.ok) return { ok: false, error: refs.error };
  const totals = computeTotals(normalized.items, input.discount);

  const { error } = await admin
    .from("quotes")
    .update({
      client_id: input.clientId,
      equipment_id: input.equipmentId ?? null,
      labor_amount: totals.laborAmount,
      discount: Number(input.discount) || 0,
      subtotal: totals.subtotal,
      total: totals.total,
      payment_terms: input.paymentTerms?.trim() || null,
      valid_until: input.validUntil || null,
    })
    .eq("id", quoteId);
  if (error) return { ok: false, error: "No se pudo actualizar el presupuesto." };

  await admin.from("quote_items").delete().eq("quote_id", quoteId);
  await insertItems(admin, quoteId, normalized.items);

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "quotes.update",
    entityType: "quotes",
    entityId: quoteId,
    newData: { total: totals.total },
  });

  return { ok: true };
}

export async function deleteQuote(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canDelete: boolean;
  quoteId: string;
}): Promise<ServiceResult> {
  if (!args.canDelete) return { ok: false, error: "No autorizado." };
  const { admin, company, actorUserId, quoteId } = args;

  const { data: existing } = await admin
    .from("quotes")
    .select("status")
    .eq("id", quoteId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Presupuesto no encontrado." };
  if (existing.status !== "draft") {
    return { ok: false, error: "Solo se puede eliminar un presupuesto en borrador." };
  }

  await admin.from("quotes").delete().eq("id", quoteId);

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "quotes.delete",
    entityType: "quotes",
    entityId: quoteId,
  });

  return { ok: true };
}

/** draft → enviado: genera el token de aceptación y devuelve el enlace. */
export async function sendQuote(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canSend: boolean;
  quoteId: string;
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  if (!args.canSend) return { ok: false, error: "No autorizado." };
  const { admin, company, actorUserId, quoteId } = args;

  const { data: existing } = await admin
    .from("quotes")
    .select("status, valid_until")
    .eq("id", quoteId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Presupuesto no encontrado." };
  if (existing.status !== "draft") {
    return { ok: false, error: "Solo se puede enviar un presupuesto en borrador." };
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = existing.valid_until
    ? new Date(`${existing.valid_until}T23:59:59Z`)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const { error: tokenError } = await admin.from("quote_acceptance_tokens").insert({
    quote_id: quoteId,
    token,
    expires_at: expiresAt.toISOString(),
  });
  if (tokenError) return { ok: false, error: "No se pudo generar el enlace." };

  const { error } = await admin
    .from("quotes")
    .update({ status: "enviado" })
    .eq("id", quoteId);
  if (error) return { ok: false, error: "No se pudo enviar el presupuesto." };

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "quotes.send",
    entityType: "quotes",
    entityId: quoteId,
  });

  return { ok: true, token };
}

/** Aceptación/rechazo por link público (token). Sin cuenta. */
export async function respondToQuoteByToken(args: {
  admin: SupabaseClient;
  token: string;
  accept: boolean;
}): Promise<ServiceResult> {
  const { admin, token, accept } = args;

  const { data: tokenRow } = await admin
    .from("quote_acceptance_tokens")
    .select("quote_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!tokenRow) return { ok: false, error: "Enlace inválido." };
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "El enlace expiró." };
  }

  const { data: quote } = await admin
    .from("quotes")
    .select("id, company_id, status")
    .eq("id", tokenRow.quote_id)
    .maybeSingle();
  if (!quote) return { ok: false, error: "Presupuesto no encontrado." };
  if (quote.status !== "enviado") {
    return { ok: false, error: "Este presupuesto ya fue respondido." };
  }

  const status = accept ? "aceptado" : "rechazado";
  const { error } = await admin
    .from("quotes")
    .update({ status, accepted_at: accept ? new Date().toISOString() : null })
    .eq("id", quote.id);
  if (error) return { ok: false, error: "No se pudo registrar la respuesta." };

  await writeAuditLog(admin, {
    companyId: quote.company_id,
    userId: null,
    action: accept ? "quotes.accept_token" : "quotes.reject_token",
    entityType: "quotes",
    entityId: quote.id,
    newData: { status },
  });

  return { ok: true };
}

/** Aceptación/rechazo manual por un usuario interno. */
export async function respondToQuoteInternal(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canUpdate: boolean;
  quoteId: string;
  accept: boolean;
}): Promise<ServiceResult> {
  if (!args.canUpdate) return { ok: false, error: "No autorizado." };
  const { admin, company, actorUserId, quoteId, accept } = args;

  const { data: existing } = await admin
    .from("quotes")
    .select("status")
    .eq("id", quoteId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Presupuesto no encontrado." };
  if (existing.status !== "enviado") {
    return { ok: false, error: "El presupuesto debe estar enviado para responderlo." };
  }

  const status = accept ? "aceptado" : "rechazado";
  const { error } = await admin
    .from("quotes")
    .update({ status, accepted_at: accept ? new Date().toISOString() : null })
    .eq("id", quoteId);
  if (error) return { ok: false, error: "No se pudo registrar la respuesta." };

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: accept ? "quotes.accept" : "quotes.reject",
    entityType: "quotes",
    entityId: quoteId,
    newData: { status },
  });

  return { ok: true };
}
