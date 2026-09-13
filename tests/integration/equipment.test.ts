import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  createEquipment,
  deleteEquipment as deleteEquipmentService,
} from "@/server/services/equipment";
import { submitInquiry } from "@/server/services/inquiries";
import { createClient as createClientService } from "@/server/services/clients";

loadEnv({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

const run = describe.skipIf(!url || !anon || !serviceRole);

run("Equipos y QR (Fase 4)", () => {
  const suffix = Date.now().toString(36).toUpperCase();
  const codeA = `EQA${suffix}`.slice(0, 8);
  const codeB = `EQB${suffix}`.slice(0, 8);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createClient(url!, serviceRole!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anonClient: any = createClient(url!, anon!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let companyA: string;
  let companyB: string;
  let userIdA: string;
  let userIdB: string;
  let clientId: string;
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
    const a = await makeCompany(codeA, `eqa${suffix.toLowerCase()}@internal.app`, "eqa");
    const b = await makeCompany(codeB, `eqb${suffix.toLowerCase()}@internal.app`, "eqb");
    companyA = a.companyId;
    companyB = b.companyId;
    userIdA = a.userId;
    userIdB = b.userId;

    const client = await createClientService({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: {
        name: "Cliente EQ",
        addresses: [{ address: "Av Test 123", isPrimary: true }],
        contacts: [{ name: "Titular", phone: "555-0000" }],
      },
    });
    if (client.ok) clientId = client.clientId;

    const signIn = createClient(url!, anon!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await signIn.auth.signInWithPassword({
      email: `eqb${suffix.toLowerCase()}@internal.app`,
      password: "Test1234!",
    });
    if (error || !data.session) throw new Error("signIn B failed");
    clientB = userClient(data.session.access_token);
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

  it("crea equipo con qr_token criptográfico", async () => {
    const result = await createEquipment({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: {
        clientId,
        equipmentType: "split",
        brand: "MarcaTest",
        model: "ModeloTest",
        serialNumber: "SN-SECRETO",
        locationLabel: "Living principal",
        refrigerantType: "R410A",
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.qrToken.length).toBeGreaterThan(20);
    }
  });

  it("whitelist: la RPC pública no expone datos sensibles", async () => {
    const created = await createEquipment({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: {
        clientId,
        equipmentType: "ventana",
        brand: "WhitelistBrand",
        model: "WL-1",
        serialNumber: "SN-SUPER-SECRETO",
        locationLabel: "Dormitorio",
        installDate: "2023-05-10",
      },
    });
    expect(created.ok).toBe(true);

    const { data, error } = await anonClient.rpc("get_equipment_public", {
      p_token: created.ok ? created.qrToken : "",
      p_ip_hash: "testhash",
    });
    expect(error).toBeFalsy();
    expect(data.found).toBe(true);
    expect(data.brand).toBe("WhitelistBrand");
    expect(data.model).toBe("WL-1");
    expect(data.install_date).toBe("2023-05-10");

    // Campos sensibles NO deben viajar a la vista pública
    expect(data.serial_number).toBeUndefined();
    expect(data.location_label).toBeUndefined();
    expect(data.client_id).toBeUndefined();
    expect(data.company_id).toBeUndefined();
    expect(data.qr_token).toBeUndefined();
  });

  it("auditoría: la RPC registra el acceso en qr_access_audit", async () => {
    const created = await createEquipment({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { clientId, equipmentType: "otro", brand: "AuditBrand" },
    });
    expect(created.ok).toBe(true);

    await anonClient.rpc("get_equipment_public", {
      p_token: created.ok ? created.qrToken : "",
      p_ip_hash: "hash-abc",
    });

    const { data: audit } = await admin
      .from("qr_access_audit")
      .select("action, actor_type, ip_hash")
      .eq("equipment_id", created.ok ? created.equipmentId : "")
      .single();
    expect(audit.action).toBe("view");
    expect(audit.actor_type).toBe("anon");
    expect(audit.ip_hash).toBe("hash-abc");
  });

  it("token inválido devuelve found=false", async () => {
    const { data } = await anonClient.rpc("get_equipment_public", {
      p_token: "token-que-no-existe",
      p_ip_hash: "x",
    });
    expect(data.found).toBe(false);
  });

  it("aislamiento: miembro de B no ve equipos de A", async () => {
    const created = await createEquipment({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { clientId, equipmentType: "otro", brand: "IsoBrand" },
    });
    expect(created.ok).toBe(true);

    const { data: rows } = await clientB.from("equipment").select("id");
    const ids = ((rows ?? []) as { id: string }[]).map((r) => r.id);
    expect(ids).not.toContain(created.ok ? created.equipmentId : "");
  });

  it("submitInquiry inserta la consulta del visitante", async () => {
    const created = await createEquipment({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { clientId, equipmentType: "otro", brand: "InquiryBrand" },
    });
    expect(created.ok).toBe(true);

    const result = await submitInquiry({
      admin,
      token: created.ok ? created.qrToken : "",
      visitorName: "Visitante",
      visitorContact: "vis@test.com",
      message: "Necesito service",
    });
    expect(result.ok).toBe(true);

    const { data } = await admin
      .from("qr_inquiries")
      .select("status")
      .eq("equipment_id", created.ok ? created.equipmentId : "")
      .single();
    expect(data.status).toBe("nuevo");
  });

  it("deniega creación de equipo sin permiso", async () => {
    const result = await createEquipment({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: false,
      input: { clientId, equipmentType: "otro" },
    });
    expect(result.ok).toBe(false);
  });

  it("deniega eliminación de equipo sin permiso", async () => {
    const created = await createEquipment({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { clientId, equipmentType: "otro", brand: "NoDel" },
    });
    expect(created.ok).toBe(true);

    const del = await deleteEquipmentService({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canDelete: false,
      equipmentId: created.ok ? created.equipmentId : "",
    });
    expect(del.ok).toBe(false);
  });

  it("anon no puede insertar qr_inquiries directamente", async () => {
    const created = await createEquipment({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { clientId, equipmentType: "otro", brand: "NoAnonInq" },
    });
    expect(created.ok).toBe(true);

    const { error } = await anonClient.from("qr_inquiries").insert({
      equipment_id: created.ok ? created.equipmentId : "",
      visitor_name: "x",
      visitor_contact: "y",
    });
    expect(error).toBeTruthy();
  });

  it("no elimina equipo de otra empresa", async () => {
    const created = await createEquipment({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { clientId, equipmentType: "otro", brand: "DelBrand" },
    });
    expect(created.ok).toBe(true);

    const del = await deleteEquipmentService({
      admin,
      company: { id: companyB },
      actorUserId: userIdB,
      canDelete: true,
      equipmentId: created.ok ? created.equipmentId : "",
    });
    expect(del.ok).toBe(false);
  });
});
