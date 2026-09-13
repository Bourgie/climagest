"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission, requireUser } from "@/server/auth";
import {
  applyLateFee,
  applyPayment,
  createCharge,
  deleteCharge,
  deletePayment,
  registerPayment,
  removeApplication,
  updateCharge,
} from "@/server/services/accounting";

export type AccountingActionState = { error?: string; success?: boolean };

const chargeSchema = z.object({
  clientId: z.string().uuid("Cliente inválido"),
  description: z.string().trim().min(1, "Descripción requerida"),
  amount: z.coerce.number().positive("Monto inválido"),
  dueDate: z.string().optional(),
});

export async function createChargeAction(
  _prev: AccountingActionState,
  formData: FormData,
): Promise<AccountingActionState> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) return { error: "No autorizado." };

  const parsed = chargeSchema.safeParse({
    clientId: formData.get("clientId"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    dueDate: formData.get("dueDate") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const admin = createAdminClient();
  const result = await createCharge({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    canCreate: await hasPermission(user, "charges.create"),
    input: {
      clientId: parsed.data.clientId,
      description: parsed.data.description,
      amount: parsed.data.amount,
      dueDate: parsed.data.dueDate || null,
    },
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/cuenta-corriente");
  return { success: true };
}

const paymentSchema = z.object({
  clientId: z.string().uuid("Cliente inválido"),
  amount: z.coerce.number().positive("Monto inválido"),
  method: z.string(),
  paidAt: z.string().optional(),
  notes: z.string().optional(),
});

export async function registerPaymentAction(
  _prev: AccountingActionState,
  formData: FormData,
): Promise<AccountingActionState> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) return { error: "No autorizado." };

  const parsed = paymentSchema.safeParse({
    clientId: formData.get("clientId"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    paidAt: formData.get("paidAt") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const admin = createAdminClient();
  const result = await registerPayment({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    canRegister: await hasPermission(user, "payments.register"),
    input: {
      clientId: parsed.data.clientId,
      amount: parsed.data.amount,
      method: parsed.data.method,
      paidAt: parsed.data.paidAt,
      notes: parsed.data.notes,
    },
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/cuenta-corriente");
  return { success: true };
}

export async function applyPaymentAction(
  _prev: AccountingActionState,
  formData: FormData,
): Promise<AccountingActionState> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) return { error: "No autorizado." };

  const paymentId = String(formData.get("paymentId") ?? "");
  const chargeId = String(formData.get("chargeId") ?? "");
  const amount = Number(formData.get("amount") ?? 0);

  const admin = createAdminClient();
  const result = await applyPayment({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    canRegister: await hasPermission(user, "payments.register"),
    paymentId,
    chargeId,
    amount,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/cuenta-corriente");
  return { success: true };
}

export async function removeApplicationAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/cuenta-corriente");

  const paymentId = String(formData.get("paymentId") ?? "");
  const chargeId = String(formData.get("chargeId") ?? "");

  const admin = createAdminClient();
  await removeApplication({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    canRegister: await hasPermission(user, "payments.register"),
    paymentId,
    chargeId,
  });

  revalidatePath("/cuenta-corriente");
  redirect("/cuenta-corriente");
}

export async function deletePaymentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/cuenta-corriente");

  const paymentId = String(formData.get("paymentId") ?? "");
  const admin = createAdminClient();
  await deletePayment({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    canDelete: await hasPermission(user, "payments.delete"),
    paymentId,
  });

  revalidatePath("/cuenta-corriente");
  redirect("/cuenta-corriente");
}

export async function deleteChargeAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/cuenta-corriente");

  const chargeId = String(formData.get("chargeId") ?? "");
  const admin = createAdminClient();
  await deleteCharge({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    canDelete: await hasPermission(user, "charges.delete"),
    chargeId,
  });

  revalidatePath("/cuenta-corriente");
  redirect("/cuenta-corriente");
}

export async function applyLateFeeAction(
  _prev: AccountingActionState,
  formData: FormData,
): Promise<AccountingActionState> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) return { error: "No autorizado." };

  const chargeId = String(formData.get("chargeId") ?? "");
  const amount = Number(formData.get("amount") ?? 0);

  const admin = createAdminClient();
  const result = await applyLateFee({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    isOwner: user.role === "owner",
    chargeId,
    lateFeeAmount: amount,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/cuenta-corriente");
  return { success: true };
}

export async function updateChargeAction(
  _prev: AccountingActionState,
  formData: FormData,
): Promise<AccountingActionState> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) return { error: "No autorizado." };

  const chargeId = String(formData.get("chargeId") ?? "");
  const description = String(formData.get("description") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "");

  const admin = createAdminClient();
  const result = await updateCharge({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    canUpdate: await hasPermission(user, "charges.update"),
    chargeId,
    input: { description, dueDate: dueDate || null },
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/cuenta-corriente");
  return { success: true };
}
