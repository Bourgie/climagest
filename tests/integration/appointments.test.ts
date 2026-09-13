import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  createAppointment,
  deleteAppointment as deleteAppointmentService,
  updateAppointmentStatus,
} from "@/server/services/appointments";
import { createClient as createClientService } from "@/server/services/clients";

loadEnv({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

const run = describe.skipIf(!url || !anon || !serviceRole);

run("Agenda (Fase 6)", () => {
  const suffix = Date.now().toString(36).toUpperCase();
  const codeA = `AGA${suffix}`.slice(0, 8);
  const codeB = `AGB${suffix}`.slice(0, 8);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createClient(url!, serviceRole!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let companyA: string;
  let companyB: string;
  let userIdA: string;
  let technicianA: string;
  let technicianA2: string;
  let technicianB: string;
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

  async function makeUser(username: string, role: string, companyId: string, code: string) {
    const email = `${username}+${code.toLowerCase()}@internal.app`;
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
      company_id: companyId,
      role,
      status: "active",
    });
    return u.data.user.id;
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
    companyB = cb.data.id;
    createdCompanies.push(companyB);

    userIdA = await makeUser("ownerag", "owner", companyA, codeA);
    technicianA = await makeUser("techag", "technician", companyA, codeA);
    technicianA2 = await makeUser("techag2", "technician", companyA, codeA);
    technicianB = await makeUser("techbg", "technician", companyB, codeB);

    const client = await createClientService({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { name: "Cliente Agenda", addresses: [], contacts: [] },
    });
    if (client.ok) clientId = client.clientId;

    const signIn = createClient(url!, anon!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Crear owner de B
    const ub = await admin.auth.admin.createUser({
      email: `ownerb${suffix.toLowerCase()}@internal.app`,
      password: "Test1234!",
      email_confirm: true,
    });
    createdUsers.push(ub.data.user.id);
    await admin.from("profiles").insert({
      id: ub.data.user.id,
      full_name: "ownerb",
      username: "ownerb",
      internal_email: `ownerb${suffix.toLowerCase()}@internal.app`,
    });
    await admin.from("memberships").insert({
      user_id: ub.data.user.id,
      company_id: companyB,
      role: "owner",
      status: "active",
    });
    const sb = await signIn.auth.signInWithPassword({
      email: `ownerb${suffix.toLowerCase()}@internal.app`,
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

  it("crea un turno con múltiples técnicos", async () => {
    const result = await createAppointment({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: {
        clientId,
        appointmentType: "instalacion",
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        technicianIds: [technicianA, technicianA2],
        origin: "llamada",
      },
    });
    expect(result.ok).toBe(true);

    const { data: techs } = await admin
      .from("appointment_technicians")
      .select("technician_id")
      .eq("appointment_id", result.ok ? result.appointmentId : "");
    const techIds = ((techs ?? []) as { technician_id: string }[]).map(
      (t) => t.technician_id,
    );
    expect(techIds).toContain(technicianA);
    expect(techIds).toContain(technicianA2);
  });

  it("rechaza un técnico de otra empresa", async () => {
    const result = await createAppointment({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: {
        clientId,
        appointmentType: "instalacion",
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        technicianIds: [technicianB],
        origin: "llamada",
      },
    });
    expect(result.ok).toBe(false);
  });

  it("aislamiento: miembro de B no ve appointment_technicians de A", async () => {
    const created = await createAppointment({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: {
        clientId,
        appointmentType: "instalacion",
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        technicianIds: [technicianA],
        origin: "llamada",
      },
    });
    expect(created.ok).toBe(true);

    const { data: rows } = await clientB.from("appointment_technicians").select("appointment_id");
    const ids = ((rows ?? []) as { appointment_id: string }[]).map((r) => r.appointment_id);
    expect(ids).not.toContain(created.ok ? created.appointmentId : "");
  });

  it("deniega creación sin permiso", async () => {
    const result = await createAppointment({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: false,
      input: { clientId, appointmentType: "instalacion", scheduledAt: new Date().toISOString(), technicianIds: [], origin: "llamada" },
    });
    expect(result.ok).toBe(false);
  });

  it("actualiza el estado del turno", async () => {
    const created = await createAppointment({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { clientId, appointmentType: "instalacion", scheduledAt: new Date(Date.now() + 86400000).toISOString(), technicianIds: [], origin: "llamada" },
    });
    if (!created.ok) throw new Error(created.error);
    const appointmentId = created.appointmentId!;

    const upd = await updateAppointmentStatus({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canUpdate: true,
      appointmentId,
      status: "confirmado",
    });
    expect(upd.ok).toBe(true);

    const { data } = await admin
      .from("appointments")
      .select("status")
      .eq("id", appointmentId)
      .single();
    expect(data.status).toBe("confirmado");
  });

  it("aislamiento: miembro de B no ve turnos de A", async () => {
    const created = await createAppointment({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { clientId, appointmentType: "instalacion", scheduledAt: new Date(Date.now() + 86400000).toISOString(), technicianIds: [], origin: "llamada" },
    });
    if (!created.ok) throw new Error(created.error);
    const appointmentId = created.appointmentId!;

    const { data: rows } = await clientB.from("appointments").select("id");
    const ids = ((rows ?? []) as { id: string }[]).map((r) => r.id);
    expect(ids).not.toContain(appointmentId);
  });

  it("no elimina turno de otra empresa", async () => {
    const created = await createAppointment({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { clientId, appointmentType: "instalacion", scheduledAt: new Date(Date.now() + 86400000).toISOString(), technicianIds: [], origin: "llamada" },
    });
    if (!created.ok) throw new Error(created.error);
    const appointmentId = created.appointmentId!;

    const del = await deleteAppointmentService({
      admin,
      company: { id: companyB },
      actorUserId: userIdA,
      canDelete: true,
      appointmentId,
    });
    expect(del.ok).toBe(false);
  });
});
