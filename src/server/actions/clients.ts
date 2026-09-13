"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission, requireUser } from "@/server/auth";
import {
  createClient,
  deleteClient,
  updateClient,
  type ClientInput,
} from "@/server/services/clients";

const addressSchema = z.object({
  label: z.string().optional(),
  address: z.string(),
  isPrimary: z.boolean(),
});
const contactSchema = z.object({
  name: z.string(),
  roleLabel: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});
const clientSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido"),
  notes: z.string().optional(),
  addresses: z.array(addressSchema),
  contacts: z.array(contactSchema),
});

export type ClientFormState = { error?: string };

function parseInput(
  formData: FormData,
): { ok: true; data: ClientInput } | { ok: false; error: string } {
  let addresses: unknown = [];
  let contacts: unknown = [];
  try {
    addresses = JSON.parse(String(formData.get("addresses") ?? "[]"));
    contacts = JSON.parse(String(formData.get("contacts") ?? "[]"));
  } catch {
    return { ok: false, error: "Datos inválidos." };
  }

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    notes: formData.get("notes") || undefined,
    addresses,
    contacts,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  return { ok: true, data: parsed.data };
}

export async function saveClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) return { error: "No autorizado." };

  const clientId = String(formData.get("clientId") ?? "");
  const parsed = parseInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const admin = createAdminClient();
  const company = { id: user.companyId };

  if (clientId) {
    const result = await updateClient({
      admin,
      company,
      actorUserId: user.id,
      canUpdate: await hasPermission(user, "clients.update"),
      clientId,
      input: parsed.data,
    });
    if (!result.ok) return { error: result.error };
    revalidatePath("/clientes");
    redirect(`/clientes/${clientId}`);
  }

  const result = await createClient({
    admin,
    company,
    actorUserId: user.id,
    canCreate: await hasPermission(user, "clients.create"),
    input: parsed.data,
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function deleteClientAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/clientes");

  const clientId = String(formData.get("clientId") ?? "");
  const admin = createAdminClient();
  await deleteClient({
    admin,
    company: { id: user.companyId },
    actorUserId: user.id,
    canDelete: await hasPermission(user, "clients.delete"),
    clientId,
  });

  revalidatePath("/clientes");
  redirect("/clientes");
}
