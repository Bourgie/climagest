import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "./audit";
import type { ServiceResult } from "./types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export type ChargeStatus = "pendiente" | "parcial" | "pagado" | "vencido";

/** Total adeudado de un cargo (monto + mora aplicada). */
export function chargeOwed(amount: number, lateFee: number): number {
  return round2(amount + lateFee);
}

/** Estado derivado en vivo (misma regla que el almacenado). */
export function displayStatus(
  amount: number,
  lateFee: number,
  applied: number,
  dueDate: string | null,
): ChargeStatus {
  const balance = round2(chargeOwed(amount, lateFee) - applied);
  if (balance <= 0) return "pagado";
  if (dueDate && new Date(dueDate) < startOfToday()) return "vencido";
  if (applied > 0) return "parcial";
  return "pendiente";
}

async function chargeApplied(admin: SupabaseClient, chargeId: string): Promise<number> {
  const { data } = await admin
    .from("payment_applications")
    .select("amount_applied")
    .eq("charge_id", chargeId);
  return round2((data ?? []).reduce((s, r) => s + Number(r.amount_applied), 0));
}

async function paymentRemainder(admin: SupabaseClient, paymentId: string, paymentAmount: number): Promise<number> {
  const { data } = await admin
    .from("payment_applications")
    .select("amount_applied")
    .eq("payment_id", paymentId);
  const applied = round2((data ?? []).reduce((s, r) => s + Number(r.amount_applied), 0));
  return round2(paymentAmount - applied);
}

export async function recomputeChargeStatus(
  admin: SupabaseClient,
  chargeId: string,
): Promise<void> {
  const { data: charge } = await admin
    .from("account_charges")
    .select("amount, late_fee_amount, due_date")
    .eq("id", chargeId)
    .maybeSingle();
  if (!charge) return;
  const applied = await chargeApplied(admin, chargeId);
  const status = displayStatus(
    Number(charge.amount),
    Number(charge.late_fee_amount),
    applied,
    charge.due_date,
  );
  await admin.from("account_charges").update({ status }).eq("id", chargeId);
}

export async function createCharge(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canCreate: boolean;
  input: {
    clientId: string;
    description: string;
    amount: number;
    dueDate?: string | null;
    relatedWorkOrderId?: string | null;
  };
}): Promise<{ ok: true; chargeId: string; warning?: string | null } | { ok: false; error: string }> {
  if (!args.canCreate) {
    return { ok: false, error: "No tenés permiso para crear cargos." };
  }
  const { admin, company, actorUserId, input } = args;
  const amount = round2(Number(input.amount) || 0);
  if (amount <= 0) return { ok: false, error: "El monto debe ser mayor a 0." };
  if (!input.description.trim()) return { ok: false, error: "La descripción es requerida." };

  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("id", input.clientId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!client) return { ok: false, error: "Cliente no encontrado." };

  if (input.relatedWorkOrderId) {
    const { data: wo } = await admin
      .from("work_orders")
      .select("id")
      .eq("id", input.relatedWorkOrderId)
      .eq("company_id", company.id)
      .maybeSingle();
    if (!wo) return { ok: false, error: "Orden de trabajo no encontrada." };
  }

  // Verificar garantía activa antes de crear el cargo
  let warrantyWarning: string | null = null;
  if (input.relatedWorkOrderId) {
    const { data: wo } = await admin
      .from("work_orders")
      .select("warranty_until")
      .eq("id", input.relatedWorkOrderId)
      .eq("company_id", company.id)
      .maybeSingle();
    if (wo && wo.warranty_until && new Date(wo.warranty_until) >= new Date()) {
      warrantyWarning = `⚠️ Equipo en garantía hasta ${new Date(wo.warranty_until).toLocaleDateString("es-AR")}. Verificá antes de cobrar.`;
    }
  }

  const status = displayStatus(amount, 0, 0, input.dueDate ?? null);
  const { data: charge, error } = await admin
    .from("account_charges")
    .insert({
      company_id: company.id,
      client_id: input.clientId,
      related_work_order_id: input.relatedWorkOrderId ?? null,
      description: input.description.trim(),
      amount,
      due_date: input.dueDate || null,
      status: "pendiente",
    })
    .select("id")
    .single();
  if (error || !charge) return { ok: false, error: "No se pudo crear el cargo." };

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "charges.create",
    entityType: "account_charges",
    entityId: charge.id,
    newData: { amount, warning: warrantyWarning },
  });

  return { ok: true, chargeId: charge.id, warning: warrantyWarning };
}

export async function registerPayment(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canRegister: boolean;
  input: {
    clientId: string;
    amount: number;
    method: string;
    paidAt?: string;
    notes?: string;
  };
}): Promise<{ ok: true; paymentId: string } | { ok: false; error: string }> {
  if (!args.canRegister) {
    return { ok: false, error: "No tenés permiso para registrar pagos." };
  }
  const { admin, company, actorUserId, input } = args;
  const amount = round2(Number(input.amount) || 0);
  if (amount <= 0) return { ok: false, error: "El monto debe ser mayor a 0." };

  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("id", input.clientId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!client) return { ok: false, error: "Cliente no encontrado." };

  const { data: payment, error } = await admin
    .from("payments")
    .insert({
      company_id: company.id,
      client_id: input.clientId,
      amount,
      method: input.method,
      paid_at: input.paidAt || new Date().toISOString(),
      notes: input.notes?.trim() || null,
      created_by: actorUserId,
    })
    .select("id")
    .single();
  if (error || !payment) return { ok: false, error: "No se pudo registrar el pago." };

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "payments.register",
    entityType: "payments",
    entityId: payment.id,
    newData: { amount, method: input.method },
  });

  // El pago NO se aplica automáticamente. El usuario elige manualmente
  // a qué cargos aplicarlo (ver applyPayment).
  return { ok: true, paymentId: payment.id };
}

/**
 * Aplica manualmente un pago a un cargo específico (nunca automático).
 * Puede repartirse un pago entre varios cargos con múltiples aplicaciones.
 */
export async function applyPayment(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canRegister: boolean;
  paymentId: string;
  chargeId: string;
  amount: number;
}): Promise<ServiceResult> {
  if (!args.canRegister) return { ok: false, error: "No autorizado." };
  const { admin, company, actorUserId, paymentId, chargeId } = args;
  const amount = round2(Number(args.amount) || 0);
  if (amount <= 0) return { ok: false, error: "El monto debe ser mayor a 0." };

  const { data: payment } = await admin
    .from("payments")
    .select("amount, client_id")
    .eq("id", paymentId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!payment) return { ok: false, error: "Pago no encontrado." };

  const { data: charge } = await admin
    .from("account_charges")
    .select("amount, late_fee_amount, client_id")
    .eq("id", chargeId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!charge) return { ok: false, error: "Cargo no encontrado." };
  if (payment.client_id !== charge.client_id) {
    return { ok: false, error: "El pago y el cargo son de distinto cliente." };
  }

  const remainder = await paymentRemainder(admin, paymentId, Number(payment.amount));
  if (amount > remainder) {
    return { ok: false, error: `El pago solo tiene $${remainder.toFixed(2)} sin aplicar.` };
  }

  const applied = await chargeApplied(admin, chargeId);
  const balance = round2(
    chargeOwed(Number(charge.amount), Number(charge.late_fee_amount)) - applied,
  );
  if (amount > balance) {
    return { ok: false, error: `El cargo solo adeuda $${balance.toFixed(2)}.` };
  }

  // Upsert (un pago se aplica una vez por cargo; si ya existe, se suma).
  const { data: existing } = await admin
    .from("payment_applications")
    .select("amount_applied")
    .eq("payment_id", paymentId)
    .eq("charge_id", chargeId)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("payment_applications")
      .update({ amount_applied: round2(Number(existing.amount_applied) + amount) })
      .eq("payment_id", paymentId)
      .eq("charge_id", chargeId);
    if (error) return { ok: false, error: "No se pudo aplicar el pago." };
  } else {
    const { error } = await admin.from("payment_applications").insert({
      payment_id: paymentId,
      charge_id: chargeId,
      amount_applied: amount,
    });
    if (error) return { ok: false, error: "No se pudo aplicar el pago." };
  }

  await recomputeChargeStatus(admin, chargeId);

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "payments.apply",
    entityType: "payment_applications",
    newData: { paymentId, chargeId, amount },
  });

  return { ok: true };
}

export async function removeApplication(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canRegister: boolean;
  paymentId: string;
  chargeId: string;
}): Promise<ServiceResult> {
  if (!args.canRegister) return { ok: false, error: "No autorizado." };
  const { admin, company, actorUserId, paymentId, chargeId } = args;

  // Verificar que ambos son de la empresa (aislamiento).
  const { data: payment } = await admin
    .from("payments")
    .select("id")
    .eq("id", paymentId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!payment) return { ok: false, error: "Pago no encontrado." };

  await admin
    .from("payment_applications")
    .delete()
    .eq("payment_id", paymentId)
    .eq("charge_id", chargeId);

  await recomputeChargeStatus(admin, chargeId);

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "payments.unapply",
    entityType: "payment_applications",
    newData: { paymentId, chargeId },
  });

  return { ok: true };
}

export async function deletePayment(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canDelete: boolean;
  paymentId: string;
}): Promise<ServiceResult> {
  if (!args.canDelete) {
    return { ok: false, error: "No tenés permiso para eliminar pagos." };
  }
  const { admin, company, actorUserId, paymentId } = args;

  const { data: payment } = await admin
    .from("payments")
    .select("id")
    .eq("id", paymentId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!payment) return { ok: false, error: "Pago no encontrado." };

  // Cargos afectados (para recomputar su estado tras el cascade).
  const { data: apps } = await admin
    .from("payment_applications")
    .select("charge_id")
    .eq("payment_id", paymentId);

  await admin.from("payments").delete().eq("id", paymentId);

  for (const a of apps ?? []) {
    await recomputeChargeStatus(admin, a.charge_id);
  }

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "payments.delete",
    entityType: "payments",
    entityId: paymentId,
  });

  return { ok: true };
}

export async function updateCharge(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canUpdate: boolean;
  chargeId: string;
  input: { description?: string; dueDate?: string | null };
}): Promise<ServiceResult> {
  if (!args.canUpdate) return { ok: false, error: "No autorizado." };
  const { admin, company, actorUserId, chargeId, input } = args;

  const { data: charge } = await admin
    .from("account_charges")
    .select("id")
    .eq("id", chargeId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!charge) return { ok: false, error: "Cargo no encontrado." };

  const updates: Record<string, unknown> = {};
  if (input.description !== undefined) updates.description = input.description.trim();
  if (input.dueDate !== undefined) updates.due_date = input.dueDate || null;

  const { error } = await admin.from("account_charges").update(updates).eq("id", chargeId);
  if (error) return { ok: false, error: "No se pudo actualizar el cargo." };

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "charges.update",
    entityType: "account_charges",
    entityId: chargeId,
    newData: input,
  });

  return { ok: true };
}

export async function deleteCharge(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canDelete: boolean;
  chargeId: string;
}): Promise<ServiceResult> {
  if (!args.canDelete) {
    return { ok: false, error: "No tenés permiso para eliminar cargos." };
  }
  const { admin, company, actorUserId, chargeId } = args;

  const { data: charge } = await admin
    .from("account_charges")
    .select("id")
    .eq("id", chargeId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!charge) return { ok: false, error: "Cargo no encontrado." };

  await admin.from("account_charges").delete().eq("id", chargeId);

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "charges.delete",
    entityType: "account_charges",
    entityId: chargeId,
  });

  return { ok: true };
}

/**
 * Recargo por mora: SOLO el Dueño, caso por caso, con acción explícita.
 * Nunca automático. Requiere un cargo vencido (con due_date pasada y saldo).
 */
export async function applyLateFee(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  isOwner: boolean;
  chargeId: string;
  lateFeeAmount: number;
}): Promise<ServiceResult> {
  if (!args.isOwner) {
    return { ok: false, error: "Solo el Dueño puede aplicar recargos por mora." };
  }
  const { admin, company, actorUserId, chargeId } = args;
  const fee = round2(Number(args.lateFeeAmount) || 0);
  if (fee <= 0) return { ok: false, error: "El recargo debe ser mayor a 0." };

  const { data: charge } = await admin
    .from("account_charges")
    .select("amount, late_fee_amount, due_date")
    .eq("id", chargeId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!charge) return { ok: false, error: "Cargo no encontrado." };

  const applied = await chargeApplied(admin, chargeId);
  const balance = round2(Number(charge.amount) + Number(charge.late_fee_amount) - applied);
  if (balance <= 0) return { ok: false, error: "El cargo ya está pagado." };
  if (charge.due_date && new Date(charge.due_date) >= startOfToday()) {
    return { ok: false, error: "El cargo no está vencido." };
  }

  const { error } = await admin
    .from("account_charges")
    .update({ late_fee_applied: true, late_fee_amount: fee })
    .eq("id", chargeId);
  if (error) return { ok: false, error: "No se pudo aplicar el recargo." };

  await recomputeChargeStatus(admin, chargeId);

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "charges.apply_late_fee",
    entityType: "account_charges",
    entityId: chargeId,
    newData: { late_fee_amount: fee },
  });

  return { ok: true };
}

export type LedgerEntry = {
  date: string;
  kind: "charge" | "payment";
  description: string;
  debe: number;
  haber: number;
  saldo: number;
  refId: string;
};

/** Estado de cuenta tipo libro mayor (Debe/Haber/Saldo) de un cliente. */
export async function getLedger(
  admin: SupabaseClient,
  companyId: string,
  clientId: string,
): Promise<{ entries: LedgerEntry[]; balance: number }> {
  const { data: charges } = await admin
    .from("account_charges")
    .select("id, description, amount, late_fee_amount, created_at")
    .eq("company_id", companyId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });

  const { data: payments } = await admin
    .from("payments")
    .select("id, amount, paid_at, notes")
    .eq("company_id", companyId)
    .eq("client_id", clientId)
    .order("paid_at", { ascending: true });

  type Raw = { date: string; kind: "charge" | "payment"; description: string; debe: number; haber: number; refId: string };
  const raw: Raw[] = [];
  for (const c of charges ?? []) {
    raw.push({
      date: c.created_at,
      kind: "charge",
      description: c.description,
      debe: round2(Number(c.amount) + Number(c.late_fee_amount)),
      haber: 0,
      refId: c.id,
    });
  }
  for (const p of payments ?? []) {
    raw.push({
      date: p.paid_at,
      kind: "payment",
      description: p.notes || "Pago",
      debe: 0,
      haber: round2(Number(p.amount)),
      refId: p.id,
    });
  }
  raw.sort((a, b) => a.date.localeCompare(b.date));

  let saldo = 0;
  const entries: LedgerEntry[] = raw.map((r) => {
    saldo = round2(saldo + r.debe - r.haber);
    return { ...r, saldo };
  });

  return { entries, balance: saldo };
}
