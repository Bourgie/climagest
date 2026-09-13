import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  createClient as createClientService,
  deleteClient as deleteClientService,
  updateClient as updateClientService,
} from "@/server/services/clients";

loadEnv({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

const run = describe.skipIf(!url || !anon || !serviceRole);

function expectOk<T extends { ok: boolean }>(r: T): asserts r is T & { ok: true } {
  if (!r.ok) throw new Error("expected ok");
}

run("Clientes (Fase 3)", () => {
  const suffix = Date.now().toString(36).toUpperCase();
  const codeA = `CLA${suffix}`.slice(0, 8);
  const codeB = `CLB${suffix}`.slice(0, 8);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createClient(url!, serviceRole!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let companyA: string;
  let companyB: string;
  let userIdA: string;
  let userIdB: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let clientA: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let clientB: any;

  const createdUsers: string[] = [];
  const createdCompanies: string[] = [];

  function userClient(token: string) {
    return createClient(url!, anon!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  }

  async function signInToken(email: string) {
    const c = createClient(url!, anon!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await c.auth.signInWithPassword({
      email,
      password: "Test1234!",
    });
    if (error) throw new Error(`signIn ${email}: ${error.message}`);
    return data.session.access_token;
  }

  async function makeCompany(code: string, email: string, username: string) {
    const company = await admin
      .from("companies")
      .insert({ name: code, company_code: code, status: "active" })
      .select("id")
      .single();
    createdCompanies.push(company.data.id);

    const u = await admin.auth.admin.createUser({
      email,
      password: "Test1234!",
      email_confirm: true,
    });
    createdUsers.push(u.data.user.id);
    await admin.from("profiles").insert({
      id: u.data.user.id,
      full_name: username,
      username,
      internal_email: email,
    });
    await admin.from("memberships").insert({
      user_id: u.data.user.id,
      company_id: company.data.id,
      role: "owner",
      status: "active",
    });
    return { companyId: company.data.id, userId: u.data.user.id };
  }

  beforeAll(async () => {
    const a = await makeCompany(codeA, `ownera${suffix.toLowerCase()}@internal.app`, "ownera");
    const b = await makeCompany(codeB, `ownerb${suffix.toLowerCase()}@internal.app`, "ownerb");
    companyA = a.companyId;
    companyB = b.companyId;
    userIdA = a.userId;
    userIdB = b.userId;
    clientA = userClient(await signInToken(`ownera${suffix.toLowerCase()}@internal.app`));
    clientB = userClient(await signInToken(`ownerb${suffix.toLowerCase()}@internal.app`));
  });

  afterAll(async () => {
    for (const id of createdUsers) {
      try {
        await admin.auth.admin.deleteUser(id);
      } catch {
        // ya borrado
      }
    }
    for (const id of createdCompanies) {
      try {
        await admin.from("companies").delete().eq("id", id);
      } catch {
        // ya borrado
      }
    }
  });

  it("crea cliente con direcciones y contactos", async () => {
    const result = await createClientService({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: {
        name: "Cliente A",
        addresses: [
          { label: "Casa", address: "Av 1", isPrimary: true },
          { label: "Local", address: "Av 2", isPrimary: false },
        ],
        contacts: [{ name: "Juan", roleLabel: "Titular", phone: "123" }],
      },
    });
    expectOk(result);

    const { data: client } = await admin
      .from("clients")
      .select(
        "id, client_addresses(label, address, is_primary), client_contacts(name)",
      )
      .eq("id", result.clientId)
      .single();
    expect(client.client_addresses).toHaveLength(2);
    expect(client.client_contacts).toHaveLength(1);
  });

  it("deniega creación sin permiso", async () => {
    const result = await createClientService({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: false,
      input: { name: "X", addresses: [], contacts: [] },
    });
    expect(result.ok).toBe(false);
  });

  it("actualiza y elimina un cliente", async () => {
    const created = await createClientService({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { name: "Cliente B", addresses: [], contacts: [] },
    });
    expectOk(created);

    const upd = await updateClientService({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canUpdate: true,
      clientId: created.clientId,
      input: { name: "Cliente B editado", addresses: [{ address: "Dir 9", isPrimary: true }], contacts: [] },
    });
    expect(upd.ok).toBe(true);

    const { data } = await admin.from("clients").select("name").eq("id", created.clientId).single();
    expect(data.name).toBe("Cliente B editado");

    const del = await deleteClientService({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canDelete: true,
      clientId: created.clientId,
    });
    expect(del.ok).toBe(true);
  });

  it("no elimina cliente de otra empresa", async () => {
    const created = await createClientService({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { name: "Cliente A2", addresses: [], contacts: [] },
    });
    expectOk(created);

    // intento eliminar desde la empresa B
    const del = await deleteClientService({
      admin,
      company: { id: companyB },
      actorUserId: userIdB,
      canDelete: true,
      clientId: created.clientId,
    });
    expect(del.ok).toBe(false);
  });

  it("reemplaza direcciones y contactos al actualizar", async () => {
    const created = await createClientService({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: {
        name: "Cliente R",
        addresses: [
          { address: "D1", isPrimary: true },
          { address: "D2", isPrimary: false },
        ],
        contacts: [{ name: "C1", phone: "1" }],
      },
    });
    expectOk(created);

    const upd = await updateClientService({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canUpdate: true,
      clientId: created.clientId,
      input: { name: "Cliente R", addresses: [{ address: "D3", isPrimary: true }], contacts: [] },
    });
    expect(upd.ok).toBe(true);

    const { data } = await admin
      .from("clients")
      .select("client_addresses(address), client_contacts(id)")
      .eq("id", created.clientId)
      .single();
    expect(data.client_addresses).toHaveLength(1);
    expect(data.client_addresses[0].address).toBe("D3");
    expect(data.client_contacts).toHaveLength(0);
  });

  it("normaliza a una sola dirección primaria", async () => {
    const created = await createClientService({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: {
        name: "Cliente P",
        addresses: [
          { address: "A", isPrimary: true },
          { address: "B", isPrimary: true },
        ],
        contacts: [],
      },
    });
    expectOk(created);

    const { data } = await admin
      .from("client_addresses")
      .select("is_primary")
      .eq("client_id", created.clientId);
    const primaries = ((data ?? []) as { is_primary: boolean }[]).filter(
      (a) => a.is_primary,
    );
    expect(primaries).toHaveLength(1);
  });

  it("no actualiza cliente de otra empresa", async () => {
    const created = await createClientService({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { name: "Cliente U", addresses: [], contacts: [] },
    });
    expectOk(created);

    const upd = await updateClientService({
      admin,
      company: { id: companyB },
      actorUserId: userIdB,
      canUpdate: true,
      clientId: created.clientId,
      input: { name: "Hack", addresses: [], contacts: [] },
    });
    expect(upd.ok).toBe(false);
  });

  it("RLS: miembro de B no ve clientes ni direcciones de A", async () => {
    const created = await createClientService({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { name: "Cliente A3", addresses: [{ address: "Dir A", isPrimary: true }], contacts: [] },
    });
    expectOk(created);

    const { data: a } = await clientA.from("clients").select("id");
    const aIds = ((a ?? []) as { id: string }[]).map((r) => r.id);
    expect(aIds).toContain(created.clientId);

    const { data: b } = await clientB.from("clients").select("id");
    const bIds = ((b ?? []) as { id: string }[]).map((r) => r.id);
    expect(bIds).not.toContain(created.clientId);

    const { data: addrsB } = await clientB.from("client_addresses").select("id");
    expect(addrsB ?? []).toHaveLength(0);
  });
});
