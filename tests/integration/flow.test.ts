import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createServiceRequestFromQr } from "@/server/services/service-requests";
import { createQuote, respondToQuoteByToken, sendQuote } from "@/server/services/quotes";
import { createClient as createClientService } from "@/server/services/clients";
import { createEquipment } from "@/server/services/equipment";

loadEnv({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

const run = describe.skipIf(!url || !anon || !serviceRole);

run("Flujo operativo (Fase 5)", () => {
  const suffix = Date.now().toString(36).toUpperCase();
  const codeA = `FLA${suffix}`.slice(0, 8);
  const codeB = `FLB${suffix}`.slice(0, 8);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createClient(url!, serviceRole!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let companyA: string;
  let userIdA: string;
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
    const a = await makeCompany(codeA, `fla${suffix.toLowerCase()}@internal.app`, "fla");
    await makeCompany(codeB, `flb${suffix.toLowerCase()}@internal.app`, "flb");
    companyA = a.companyId;
    userIdA = a.userId;

    const client = await createClientService({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { name: "Cliente Flujo", addresses: [], contacts: [] },
    });
    if (client.ok) clientId = client.clientId;

    const signIn = createClient(url!, anon!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await signIn.auth.signInWithPassword({
      email: `flb${suffix.toLowerCase()}@internal.app`,
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

  it("crea un pedido y un presupuesto con totales correctos", async () => {
    const { data: sr } = await admin
      .from("service_requests")
      .insert({
        company_id: companyA,
        client_id: clientId,
        origin: "llamada",
        status: "recibido",
      })
      .select("id")
      .single();

    const quote = await createQuote({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: {
        serviceRequestId: sr.id,
        clientId,
        items: [
          { description: "Mano de obra", type: "mano_obra", quantity: 1, unitPrice: 100 },
          { description: "Repuesto", type: "repuesto", quantity: 2, unitPrice: 50 },
        ],
        discount: 20,
      },
    });
    expect(quote.ok).toBe(true);

    const { data: q } = await admin
      .from("quotes")
      .select("subtotal, total, labor_amount, discount")
      .eq("id", quote.ok ? quote.quoteId : "")
      .single();
    expect(Number(q.subtotal)).toBe(200); // 100 + 100
    expect(Number(q.labor_amount)).toBe(100);
    expect(Number(q.total)).toBe(180); // 200 - 20

    // El pedido debe pasar a 'presupuestado'
    const { data: updatedSr } = await admin
      .from("service_requests")
      .select("status")
      .eq("id", sr.id)
      .single();
    expect(updatedSr.status).toBe("presupuestado");
  });

  it("envía un presupuesto y lo acepta por token público", async () => {
    const quote = await createQuote({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: {
        clientId,
        items: [{ description: "Trabajo", type: "mano_obra", quantity: 1, unitPrice: 500 }],
        discount: 0,
      },
    });
    expect(quote.ok).toBe(true);

    const sent = await sendQuote({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canSend: true,
      quoteId: quote.ok ? quote.quoteId : "",
    });
    expect(sent.ok).toBe(true);

    const accept = await respondToQuoteByToken({
      admin,
      token: sent.ok ? sent.token : "",
      accept: true,
    });
    expect(accept.ok).toBe(true);

    const { data: q } = await admin
      .from("quotes")
      .select("status, accepted_at")
      .eq("id", quote.ok ? quote.quoteId : "")
      .single();
    expect(q.status).toBe("aceptado");
    expect(q.accepted_at).toBeTruthy();
  });

  it("rechaza un presupuesto por token", async () => {
    const quote = await createQuote({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: {
        clientId,
        items: [{ description: "Trabajo", type: "mano_obra", quantity: 1, unitPrice: 300 }],
        discount: 0,
      },
    });
    expect(quote.ok).toBe(true);

    const sent = await sendQuote({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canSend: true,
      quoteId: quote.ok ? quote.quoteId : "",
    });
    expect(sent.ok).toBe(true);

    const reject = await respondToQuoteByToken({
      admin,
      token: sent.ok ? sent.token : "",
      accept: false,
    });
    expect(reject.ok).toBe(true);

    const { data: q } = await admin
      .from("quotes")
      .select("status")
      .eq("id", quote.ok ? quote.quoteId : "")
      .single();
    expect(q.status).toBe("rechazado");
  });

  it("token inválido devuelve error", async () => {
    const result = await respondToQuoteByToken({
      admin,
      token: "token-invalido",
      accept: true,
    });
    expect(result.ok).toBe(false);
  });

  it("token expirado devuelve error", async () => {
    const quote = await createQuote({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: {
        clientId,
        items: [{ description: "Trabajo", type: "mano_obra", quantity: 1, unitPrice: 100 }],
        discount: 0,
      },
    });
    expect(quote.ok).toBe(true);

    // Inserta token expirado directamente
    await admin.from("quote_acceptance_tokens").insert({
      quote_id: quote.ok ? quote.quoteId : "",
      token: `expired-${suffix.toLowerCase()}`,
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    await admin
      .from("quotes")
      .update({ status: "enviado" })
      .eq("id", quote.ok ? quote.quoteId : "");

    const result = await respondToQuoteByToken({
      admin,
      token: `expired-${suffix.toLowerCase()}`,
      accept: true,
    });
    expect(result.ok).toBe(false);
  });

  it("no acepta dos veces el mismo presupuesto", async () => {
    const quote = await createQuote({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: {
        clientId,
        items: [{ description: "Trabajo", type: "mano_obra", quantity: 1, unitPrice: 100 }],
        discount: 0,
      },
    });
    expect(quote.ok).toBe(true);

    const sent = await sendQuote({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canSend: true,
      quoteId: quote.ok ? quote.quoteId : "",
    });
    expect(sent.ok).toBe(true);

    const first = await respondToQuoteByToken({
      admin,
      token: sent.ok ? sent.token : "",
      accept: true,
    });
    expect(first.ok).toBe(true);

    const second = await respondToQuoteByToken({
      admin,
      token: sent.ok ? sent.token : "",
      accept: true,
    });
    expect(second.ok).toBe(false);
  });

  it("QR Solicitar servicio crea service_request + qr_inquiry", async () => {
    const equipment = await createEquipment({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: true,
      input: { clientId, equipmentType: "otro", brand: "FlowEq" },
    });
    expect(equipment.ok).toBe(true);

    const result = await createServiceRequestFromQr({
      admin,
      token: equipment.ok ? equipment.qrToken : "",
      visitorName: "Visitante QR",
      visitorContact: "vis@qr.com",
      message: "Necesito service",
    });
    expect(result.ok).toBe(true);

    const { data: sr } = await admin
      .from("service_requests")
      .select("origin")
      .eq("equipment_id", equipment.ok ? equipment.equipmentId : "")
      .single();
    expect(sr.origin).toBe("qr_publico");

    const { data: inquiry } = await admin
      .from("qr_inquiries")
      .select("visitor_name")
      .eq("equipment_id", equipment.ok ? equipment.equipmentId : "")
      .single();
    expect(inquiry.visitor_name).toBe("Visitante QR");
  });

  it("aislamiento: miembro de B no ve pedidos ni presupuestos de A", async () => {
    // Crear un pedido en A
    const { data: sr } = await admin
      .from("service_requests")
      .insert({
        company_id: companyA,
        client_id: clientId,
        origin: "llamada",
        status: "recibido",
      })
      .select("id")
      .single();

    const { data: aRequests } = await clientB.from("service_requests").select("id");
    const aRequestIds = ((aRequests ?? []) as { id: string }[]).map((r) => r.id);
    expect(aRequestIds).not.toContain(sr.id);

    const { data: aQuotes } = await clientB.from("quotes").select("id");
    const aQuoteIds = ((aQuotes ?? []) as { id: string }[]).map((r) => r.id);
    expect(aQuoteIds).toHaveLength(0);
  });

  it("deniega creación de presupuesto sin permiso", async () => {
    const result = await createQuote({
      admin,
      company: { id: companyA },
      actorUserId: userIdA,
      canCreate: false,
      input: {
        clientId,
        items: [{ description: "Trabajo", type: "mano_obra", quantity: 1, unitPrice: 100 }],
        discount: 0,
      },
    });
    expect(result.ok).toBe(false);
  });
});
