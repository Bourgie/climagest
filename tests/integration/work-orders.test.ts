import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  createWorkOrder,
  finishWorkOrder,
  startWorkOrder,
} from "@/server/services/work-orders";
import { createClient as createClientService } from "@/server/services/clients";
import { createEquipment } from "@/server/services/equipment";

loadEnv({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

const run = describe.skipIf(!url || !anon || !serviceRole);

run("Órdenes de trabajo (Fase 7)", () => {
  const suffix = Date.now().toString(36).toUpperCase();
  const codeA = `WOA${suffix}`.slice(0, 8);
  const codeB = `WOB${suffix}`.slice(0, 8);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createClient(url!, serviceRole!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let companyA: string;
  let userIdA: string;
  let clientId: string;
  let equipmentId: string;
  let qrToken: string;
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

  beforeAll(async () => {
    const ca = await admin
      .from("companies")
      .insert({ name: codeA, company_code: codeA, status: "active" })
      .select("id")
      .single();
    companyA = ca.data.id;
    createdCompanies.push(companyA);

    const cb = await admin
      .from("companies")
      .insert({ name: codeB, company_code: codeB, status: "active" })
      .select("id")
      .single();
    createdCompanies.push(cb.data.id);

    const ua = await admin.auth.admin.createUser({
      email: `woa${suffix.toLowerCase()}@internal.app`,
      password: "Test1234!",
      email_confirm: true,
    });
    createdUsers.push(ua.data.user.id);
    userIdA = ua.data.user.id;
    await admin.from("profiles").insert({
      id: ua.data.user.id,
      full_name: "woa",
      username: "woa",
      internal_email: `woa${suffix.toLowerCase()}@internal.app`,
    });
    await admin.from("memberships").insert({
      user_id: ua.data.user.id,
      company_id: companyA,
      role: "owner",
      status: "active",
    });

    const client = await createClientService({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { name: "Cliente WO", addresses: [], contacts: [] },
    });
    if (client.ok) clientId = client.clientId;

    const equipment = await createEquipment({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { clientId, equipmentType: "split", brand: "WoBrand", model: "WoModel" },
    });
    if (equipment.ok) {
      equipmentId = equipment.equipmentId;
      qrToken = equipment.qrToken;
    }

    const ub = await admin.auth.admin.createUser({
      email: `wob${suffix.toLowerCase()}@internal.app`,
      password: "Test1234!",
      email_confirm: true,
    });
    createdUsers.push(ub.data.user.id);
    await admin.from("profiles").insert({
      id: ub.data.user.id,
      full_name: "wob",
      username: "wob",
      internal_email: `wob${suffix.toLowerCase()}@internal.app`,
    });
    await admin.from("memberships").insert({
      user_id: ub.data.user.id,
      company_id: cb.data.id,
      role: "owner",
      status: "active",
    });
    const signIn = createClient(url!, anon!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const sb = await signIn.auth.signInWithPassword({
      email: `wob${suffix.toLowerCase()}@internal.app`,
      password: "Test1234!",
    });
    if (!sb.data.session) throw new Error("signIn B failed");
    clientB = userClient(sb.data.session.access_token);
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

  it("crea una orden con materiales y mediciones opcionales", async () => {
    const result = await createWorkOrder({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: {
        equipmentId,
        visitType: "mantenimiento",
        diagnosisNotes: "Limpieza general",
        measurements: { presion_baja: 70, presion_alta: 250 },
        materials: [{ description: "Filtro", quantity: 1, unitCost: 120 }],
        warrantyDays: 30,
      },
    });
    expect(result.ok).toBe(true);

    const { data: wo } = await admin
      .from("work_orders")
      .select("status, measurements, warranty_days")
      .eq("id", result.ok ? result.workOrderId : "")
      .single();
    expect(wo.status).toBe("borrador");
    expect(wo.measurements.presion_baja).toBe(70);
    expect(wo.warranty_days).toBe(30);

    const { data: materials } = await admin
      .from("work_order_materials")
      .select("subtotal")
      .eq("work_order_id", result.ok ? result.workOrderId : "")
      .single();
    expect(Number(materials.subtotal)).toBe(120);
  });

  it("crea una orden sin mediciones (opcional)", async () => {
    const result = await createWorkOrder({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { equipmentId, visitType: "limpieza", materials: [] },
    });
    expect(result.ok).toBe(true);
  });

  it("inicia y finaliza la visita con horas reales", async () => {
    const created = await createWorkOrder({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { equipmentId, visitType: "reparacion", materials: [], warrantyDays: 15 },
    });
    expect(created.ok).toBe(true);

    const start = await startWorkOrder({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canUpdate: true,
      workOrderId: created.ok ? created.workOrderId : "",
    });
    expect(start.ok).toBe(true);

    const { data: afterStart } = await admin
      .from("work_orders")
      .select("status, actual_start_at")
      .eq("id", created.ok ? created.workOrderId : "")
      .single();
    expect(afterStart.status).toBe("en_progreso");
    expect(afterStart.actual_start_at).toBeTruthy();

    const finish = await finishWorkOrder({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canUpdate: true,
      workOrderId: created.ok ? created.workOrderId : "",
    });
    expect(finish.ok).toBe(true);

    const { data: afterFinish } = await admin
      .from("work_orders")
      .select("status, actual_end_at, warranty_until")
      .eq("id", created.ok ? created.workOrderId : "")
      .single();
    expect(afterFinish.status).toBe("completado");
    expect(afterFinish.actual_end_at).toBeTruthy();
    expect(afterFinish.warranty_until).toBeTruthy();
  });

  it("no finaliza una visita que no está en curso", async () => {
    const created = await createWorkOrder({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { equipmentId, visitType: "otro", materials: [] },
    });
    expect(created.ok).toBe(true);

    const finish = await finishWorkOrder({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canUpdate: true,
      workOrderId: created.ok ? created.workOrderId : "",
    });
    expect(finish.ok).toBe(false);
  });

  it("deniega creación sin permiso", async () => {
    const result = await createWorkOrder({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: false,
      input: { equipmentId, visitType: "otro", materials: [] },
    });
    expect(result.ok).toBe(false);
  });

  it("aislamiento: miembro de B no ve órdenes de A", async () => {
    const created = await createWorkOrder({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { equipmentId, visitType: "otro", materials: [] },
    });
    expect(created.ok).toBe(true);

    const { data: rows } = await clientB.from("work_orders").select("id");
    const ids = ((rows ?? []) as { id: string }[]).map((r) => r.id);
    expect(ids).not.toContain(created.ok ? created.workOrderId : "");
  });

  it("historial del QR: solo visitas completadas, sin diagnóstico", async () => {
    // Borrador no aparece
    await createWorkOrder({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { equipmentId, visitType: "mantenimiento", diagnosisNotes: "secreto", materials: [] },
    });

    // Completada sí aparece
    const completed = await createWorkOrder({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { equipmentId, visitType: "instalacion", materials: [] },
    });
    expect(completed.ok).toBe(true);
    await startWorkOrder({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canUpdate: true,
      workOrderId: completed.ok ? completed.workOrderId : "",
    });
    await finishWorkOrder({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canUpdate: true,
      workOrderId: completed.ok ? completed.workOrderId : "",
    });

    const { data } = await admin.rpc("get_equipment_public", {
      p_token: qrToken,
      p_ip_hash: "test",
    });

    const types = (data.history ?? []).map((h: { visit_type: string }) => h.visit_type);
    expect(types).toContain("instalacion");
    expect(types).not.toContain("mantenimiento");

    const text = JSON.stringify(data.history);
    expect(text).not.toContain("secreto");
  });
});
