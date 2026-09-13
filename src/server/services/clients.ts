import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "./audit";
import type { ServiceResult } from "./types";

export type AddressInput = {
  label?: string;
  address: string;
  isPrimary: boolean;
};

export type ContactInput = {
  name: string;
  roleLabel?: string;
  phone?: string;
  email?: string;
};

export type ClientInput = {
  name: string;
  notes?: string;
  addresses: AddressInput[];
  contacts: ContactInput[];
};

export type ClientResult =
  | { ok: true; clientId: string }
  | { ok: false; error: string };

/** Normaliza direcciones: texto/etiqueta trimmed y a lo sumo una primaria. */
function normalizeAddresses(input: AddressInput[]) {
  const rows = input
    .filter((a) => a.address.trim().length > 0)
    .map((a) => ({
      label: a.label?.trim() || null,
      address: a.address.trim(),
      is_primary: a.isPrimary,
    }));
  let primarySeen = false;
  for (const r of rows) {
    if (r.is_primary && !primarySeen) {
      primarySeen = true;
    } else if (r.is_primary) {
      r.is_primary = false;
    }
  }
  return rows;
}

function normalizeContacts(input: ContactInput[]) {
  return input
    .filter((c) => c.name.trim().length > 0)
    .map((c) => ({
      name: c.name.trim(),
      role_label: c.roleLabel?.trim() || null,
      phone: c.phone?.trim() || null,
      email: c.email?.trim() || null,
    }));
}

/** Reemplaza direcciones y contactos del cliente por los enviados. */
async function replaceChildren(
  admin: SupabaseClient,
  clientId: string,
  input: ClientInput,
) {
  await admin.from("client_addresses").delete().eq("client_id", clientId);
  await admin.from("client_contacts").delete().eq("client_id", clientId);

  const addresses = normalizeAddresses(input.addresses);
  if (addresses.length) {
    await admin
      .from("client_addresses")
      .insert(addresses.map((a) => ({ client_id: clientId, ...a })));
  }

  const contacts = normalizeContacts(input.contacts);
  if (contacts.length) {
    await admin
      .from("client_contacts")
      .insert(contacts.map((c) => ({ client_id: clientId, ...c })));
  }
}

export async function createClient(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canCreate: boolean;
  input: ClientInput;
}): Promise<ClientResult> {
  if (!args.canCreate) {
    return { ok: false, error: "No tenés permiso para crear clientes." };
  }

  const { admin, company, actorUserId, input } = args;
  const name = input.name.trim();
  if (!name) return { ok: false, error: "El nombre es requerido." };

  const { data: client, error } = await admin
    .from("clients")
    .insert({
      company_id: company.id,
      name,
      notes: input.notes?.trim() || null,
      created_by: actorUserId,
    })
    .select("id")
    .single();

  if (error || !client) return { ok: false, error: "No se pudo crear el cliente." };

  await replaceChildren(admin, client.id, input);

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "clients.create",
    entityType: "clients",
    entityId: client.id,
    newData: { name },
  });

  return { ok: true, clientId: client.id };
}

export async function updateClient(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canUpdate: boolean;
  clientId: string;
  input: ClientInput;
}): Promise<ServiceResult> {
  if (!args.canUpdate) return { ok: false, error: "No autorizado." };
  const { admin, company, actorUserId, clientId, input } = args;

  const { data: existing } = await admin
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Cliente no encontrado." };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "El nombre es requerido." };

  await admin
    .from("clients")
    .update({ name, notes: input.notes?.trim() || null })
    .eq("id", clientId);

  await replaceChildren(admin, clientId, input);

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "clients.update",
    entityType: "clients",
    entityId: clientId,
    newData: { name },
  });

  return { ok: true };
}

export async function deleteClient(args: {
  admin: SupabaseClient;
  company: { id: string };
  actorUserId: string;
  canDelete: boolean;
  clientId: string;
}): Promise<ServiceResult> {
  if (!args.canDelete) {
    return { ok: false, error: "No tenés permiso para eliminar clientes." };
  }
  const { admin, company, actorUserId, clientId } = args;

  const { data: existing } = await admin
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Cliente no encontrado." };

  await admin.from("clients").delete().eq("id", clientId);

  await writeAuditLog(admin, {
    companyId: company.id,
    userId: actorUserId,
    action: "clients.delete",
    entityType: "clients",
    entityId: clientId,
  });

  return { ok: true };
}
