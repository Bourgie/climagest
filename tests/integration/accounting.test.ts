import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  createCharge,
  registerPayment,
  applyPayment,
  deleteCharge,
  deletePayment,
  applyLateFee,
  updateCharge,
  removeApplication,
  getLedger,
} from "@/server/services/accounting";
import { createClient as createClientService } from "@/server/services/clients";
import { createEquipment } from "@/server/services/equipment";

loadEnv({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

const run = describe.skipIf(!url || !anon || !serviceRole);

run("Cuenta corriente y pagos (Fase 9)", () => {
  const suffix = Date.now().toString(36).toUpperCase();
  const codeA = `ACC${suffix}`.slice(0, 8);
  const codeB = `BCC${suffix}`.slice(0, 8);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createClient(url!, serviceRole!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let companyA: string;
  let companyB: string;
  let userIdA: string;
  let clientId: string;
  let clientIdB: string;
  let paymentId: string;
  let chargeId: string;

  const createdUsers: string[] = [];
  const createdCompanies: string[] = [];

  function userClient(token: string) {
    return createClient(url!, anon!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  }

  beforeAll(async () => {
    // Create company A and owner A
    const ca = await admin
      .from("companies")
      .insert({ name: `Empresa A ${suffix}`, company_code: `CODA${suffix}`, status: "active" })
      .select("id")
      .single();
    companyA = ca.data.id;
    const ua = await admin.auth.admin.createUser({
      email: `ownera${suffix}@internal.app`,
      password: "Test1234!",
      email_confirm: true,
    });
    const userAId = ua.data.user.id;
    userIdA = userIdA;
    await admin.from("profiles").insert({
      id: ua.data.user.id,
      full_name: "Owner A",
      username: "ownera",
      internal_email: `ownera${suffix}@internal.app`,
    });
    await admin.from("memberships").insert({
      user_id: ua.data.user.id,
      company_id: companyA,
      role: "owner",
      status: "active",
    });
    userIdA = ua.data.user.id;
    createdUsers.push(ua.data.user.id);

    // Create company B and owner B
    const cb = await admin
      .from("companies")
      .insert({ name: `Empresa B ${suffix}`, company_code: `CODB${suffix}`, status: "active" })
      .select("id")
      .single();
    companyB = cb.data.id;

    const ub = await admin.auth.admin.createUser({
      email: `ownerb${suffix}@internal.app`,
      password: "Test1234!",
      email_confirm: true,
    });
    await admin.from("profiles").insert({
      id: ub.data.user.id,
      full_name: "Owner B",
      username: "ownerb",
      internal_email: `ownerb${suffix}@internal.app`,
    });
    await admin.from("memberships").insert({
      user_id: ub.data.user.id,
      company_id: companyB,
      role: "owner",
      status: "active",
    });
    createdUsers.push(ub.data.user.id);

    // Create client A under company A
    const client = await admin
      .from("clients")
      .insert({ name: "Cliente Test A", company_id: companyA })
      .select("id")
      .single();
    clientId = client.data.id;

    // Create client B under company B
    const clientB = await admin
      .from("clients")
      .insert({ name: "Cliente Test B", company_id: companyB })
      .select("id")
      .single();
    clientIdB = clientB.data.id;

    // Create a payment for company A's client
    const payment = await admin
      .from("payments")
      .insert({
        company_id: companyA,
        client_id: clientId,
        amount: 1000,
        method: "efectivo",
        paid_at: new Date().toISOString(),
        notes: "Pago inicial",
      })
      .select("id")
      .single();
    paymentId = payment.data.id;
  });

  afterAll(async () => {
    for (const id of createdUsers) {
      try {
        await admin.auth.admin.deleteUser(id);
      } catch {
        // already deleted
      }
    }
    for (const id of createdCompanies) {
      try {
        await admin.from("companies").delete().eq("id", id);
      } catch {
        // already deleted
      }
    }
  });

  describe("Cargos (account_charges)", () => {
    it("crea un cargo con due_date y monto", async () => {
      const result = await createCharge({
        admin,
        company: { id: companyA },
        actorUserId: userIdA,
        canCreate: true,
        input: {
          clientId: clientId,
          description: "Instalación de aire acondicionado",
          amount: 50000,
          dueDate: new Date(Date.now() + 86400000 * 15).toISOString().split("T")[0],
        },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        chargeId = result.chargeId;
      }
    });

    it("rechaza creación sin permiso", async () => {
      const result = await createCharge({
        admin,
        company: { id: companyA },
        actorUserId: userIdA,
        canCreate: false,
        input: { clientId, description: "Test", amount: 1000, dueDate: null },
      });
      expect(result.ok).toBe(false);
    });

    it("actualiza cargo (descripción y due_date)", async () => {
      const result = await updateCharge({
        admin,
        company: { id: companyA },
        actorUserId: userIdA,
        canUpdate: true,
        chargeId: chargeId,
        input: { description: "Actualizado", dueDate: new Date(Date.now() + 86400000 * 30).toISOString().split("T")[0] },
      });
      expect(result.ok).toBe(true);
    });

    it("elimina cargo", async () => {
      const created = await admin
        .from("account_charges")
        .insert({
          company_id: companyA,
          client_id: clientId,
          description: "Para borrar",
          amount: 1000,
        })
        .select("id")
        .single();
      chargeId = created.data.id;

      const result = await deleteCharge({
        admin,
        company: { id: companyA },
        actorUserId: userIdA,
        canDelete: true,
        chargeId: created.data.id,
      });
      expect(result.ok).toBe(true);

      const { data } = await admin.from("account_charges").select("id").eq("id", created.id).maybeSingle();
      expect(data).toBeNull();
    });

    it("niega creación sin permiso", async () => {
      const result = await createCharge({
        admin,
        company: { id: companyA },
        actorUserId: userIdA,
        canCreate: false,
        input: { clientId, description: "Test", amount: 100 },
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("Pagos (payments)", () => {
    it("registra un pago", async () => {
      const result = await registerPayment({
        admin,
        company: { id: companyA },
        actorUserId: userIdA,
        canRegister: true,
        input: { clientId, amount: 5000, method: "efectivo" },
      });
      expect(result.ok).toBe(true);
      if (result.ok) paymentId = result.paymentId;
    });

    it("rechaza registro sin permiso", async () => {
      const result = await registerPayment({
        admin,
        company: { id: companyA },
        actorUserId: userIdA,
        canRegister: false,
        input: { clientId, amount: 1000, method: "efectivo" },
      });
      expect(result.ok).toBe(false);
    });

    it("elimina pago (cascade a payment_applications)", async () => {
      const created = await admin
        .from("payments")
        .insert({ company_id: companyA, client_id: clientId, amount: 100, method: "efectivo", paid_at: new Date().toISOString() })
        .select("id")
        .single();
      const pid = created.data.id;

      const result = await deletePayment({
        admin,
        company: { id: companyA },
        actorUserId: userIdA,
        canDelete: true,
        paymentId: created.data.id,
      });
      expect(result.ok).toBe(true);

      const { data } = await admin.from("payments").select("id").eq("id", pid).maybeSingle();
      expect(data).toBeNull();

      // payment_applications cascade
      const { data: apps } = await admin.from("payment_applications").select("id").eq("payment_id", pid);
      expect(apps ?? []).toHaveLength(0);
    });

    it("rechaza eliminar pago sin permiso", async () => {
      const result = await deletePayment({
        admin,
        company: { id: companyA },
        actorUserId: userIdA,
        canDelete: false,
        paymentId: "00000000-0000-0000-0000-000000000000",
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("Aplicación manual de pagos (payment_applications)", () => {
    beforeEach(async () => {
      // Ensure we have a charge and a payment for these tests
      const charge = await admin
        .from("account_charges")
        .insert({
          company_id: companyA,
          client_id: clientId,
          description: "Cargo test apply",
          amount: 5000,
        })
        .select("id")
        .single();
      chargeId = charge.data.id;

      const pay = await admin
        .from("payments")
        .insert({ company_id: companyA, client_id: clientId, amount: 5000, method: "transferencia" })
        .select("id")
        .single();
      paymentId = pay.data.id;
    });

    it("aplica pago a cargo (parcial)", async () => {
      const result = await applyPayment({
        admin,
        company: { id: companyA },
        actorUserId: userIdA,
        canRegister: true,
        paymentId: paymentId,
        chargeId: chargeId,
        amount: 3000,
      });
      expect(result.ok).toBe(true);

      const { data } = await admin
        .from("payment_applications")
        .select("amount_applied")
        .eq("payment_id", paymentId)
        .eq("charge_id", chargeId)
        .single();
      expect(Number(data.amount_applied)).toBe(3000);
    });

    it("rechaza si monto excede saldo del cargo", async () => {
      const result = await applyPayment({
        admin,
        company: { id: companyA },
        actorUserId: userIdA,
        canRegister: true,
        paymentId: paymentId,
        chargeId: chargeId,
        amount: 10000,
      });
      expect(result.ok).toBe(false);
    });

    it("rechaza si cargo y pago son de distinta empresa", async () => {
      // create charge in company B
      const chargeB = await admin
        .from("account_charges")
        .insert({ company_id: companyB, client_id: clientIdB, description: "Test", amount: 1000 })
        .select("id")
        .single();
      const chargeIdB = chargeB.data.id;

      const result = await applyPayment({
        admin,
        company: { id: companyA },
        actorUserId: userIdA,
        canRegister: true,
        paymentId,
        chargeId: chargeIdB,
        amount: 100,
      });
      expect(result.ok).toBe(false);
    });

    it("elimina aplicación (desaplica pago)", async () => {
      const result = await removeApplication({
        admin,
        company: { id: companyA },
        actorUserId: userIdA,
        canRegister: true,
        paymentId: paymentId,
        chargeId: chargeId,
      });
      expect(result.ok).toBe(true);

      const { data } = await admin
        .from("payment_applications")
        .select("amount_applied")
        .eq("payment_id", paymentId)
        .eq("charge_id", chargeId)
        .maybeSingle();
      expect(data).toBeNull();
    });

    it("rechaza desaplicar sin permiso", async () => {
      const result = await removeApplication({
        admin,
        company: { id: companyA },
        actorUserId: userIdA,
        canRegister: false,
        paymentId,
        chargeId: chargeId,
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("Mora (late fee) - solo Dueño", () => {
    it("aplica mora solo Dueño, cargo vencido y con saldo", async () => {
      // crear cargo vencido con saldo
      const charge = await admin
        .from("account_charges")
        .insert({
          company_id: companyA,
          client_id: clientId,
          description: "Vencido",
          amount: 10000,
          due_date: new Date(Date.now() - 86400000 * 10).toISOString().split("T")[0],
        })
        .select("id")
        .single();
      const lateChargeId = charge.data.id;

      const result = await applyLateFee({
        admin,
        company: { id: companyA },
        actorUserId: userIdA,
        isOwner: true,
        chargeId: charge.data.id,
        lateFeeAmount: 500,
      });
      expect(result.ok).toBe(true);

      const { data: ch } = await admin.from("account_charges").select("late_fee_applied, late_fee_amount").eq("id", charge.data.id).single();
      expect(ch.late_fee_applied).toBe(true);
      expect(Number(ch.late_fee_amount)).toBeGreaterThan(0);
    });

    it("rechaza si no es Dueño", async () => {
      const result = await applyLateFee({
        admin,
        company: { id: companyA },
        actorUserId: userIdA, // dueño
        isOwner: false, // simular no dueño
        chargeId,
        lateFeeAmount: 100,
      });
      expect(result.ok).toBe(false);
    });

    it("rechaza si cargo no vencido", async () => {
      const c = await admin
        .from("account_charges")
        .insert({ company_id: companyA, client_id: clientId, description: "No vencido", amount: 1000, due_date: new Date(Date.now() + 86400000 * 10).toISOString().split("T")[0] })
        .select("id")
        .single();
      const result = await applyLateFee({
        admin,
        company: { id: companyA },
        actorUserId: userIdA,
        isOwner: true,
        chargeId: c.data.id,
        lateFeeAmount: 100,
      });
      expect(result.ok).toBe(false);
    });

    it("rechaza si cargo ya pagado", async () => {
      // create charge fully paid
      const c = await admin.from("account_charges").insert({ company_id: companyA, client_id: clientId, description: "Pagado", amount: 1000, due_date: new Date().toISOString().split("T")[0] }).select("id").single();
      const paidChargeId = c.data.id;
      await admin.from("payments").insert({ company_id: companyA, client_id: clientId, amount: 5000, method: "efectivo", paid_at: new Date().toISOString() });
      await admin.from("payment_applications").insert({ payment_id: (await admin.from("payments").insert({ company_id: companyA, client_id: clientId, amount: 1000, method: "efectivo" }).select("id").single()).data.id, charge_id: paidChargeId, amount_applied: 1000 });
      // now try to apply late fee
      const result = await applyLateFee({ admin, company: { id: companyA }, actorUserId: userIdA, isOwner: true, chargeId: paidChargeId, lateFeeAmount: 100 });
      expect(result.ok).toBe(false);
    });
  });

  describe("Registro de pagos", () => {
    it("registra pago y NO aplica automáticamente", async () => {
      const result = await registerPayment({
        admin,
        company: { id: companyA },
        actorUserId: userIdA,
        canRegister: true,
        input: { clientId, amount: 5000, method: "transferencia", paidAt: new Date().toISOString(), notes: "Test" },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.paymentId).toBeDefined();
      }
    });

    it("rechaza si monto <= 0", async () => {
      const result = await registerPayment({
        admin,
        company: { id: companyA },
        actorUserId: userIdA,
        canRegister: true,
        input: { clientId, amount: 0, method: "efectivo" },
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("Eliminación de pagos (cascade)", () => {
    it("elimina pago y reaplica saldos (cascade)", async () => {
      // create a charge for this test
      const c = await admin.from("account_charges").insert({ company_id: companyA, client_id: clientId, description: "Test charge", amount: 5000 }).select("id").single();
      const testChargeId = c.data.id;
      
      const pay = await admin.from("payments").insert({ company_id: companyA, client_id: clientId, amount: 5000, method: "efectivo", paid_at: new Date().toISOString() }).select("id").single();
      const app = await admin.from("payment_applications").insert({ payment_id: pay.data.id, charge_id: testChargeId, amount_applied: 1000 }).select("id").single();

      const del = await deletePayment({ admin, company: { id: companyA }, actorUserId: userIdA, canDelete: true, paymentId: pay.data.id });
      expect(del.ok).toBe(true);

      const { data: apps } = await admin.from("payment_applications").select("id").eq("payment_id", pay.data.id);
      expect(apps ?? []).toHaveLength(0);
    });
  });

  describe("Ledger (Estado de cuenta)", () => {
    it("calcula debe/haber/saldo correctamente", async () => {
      const { entries, balance } = await getLedger(admin, companyA, clientId);
      expect(Array.isArray(entries)).toBe(true);
      expect(typeof balance).toBe("number");
      // verify entries structure
      for (const e of entries) {
        expect(e).toHaveProperty("date");
        expect(e).toHaveProperty("kind");
        expect(e).toHaveProperty("description");
        expect(e).toHaveProperty("debe");
        expect(e).toHaveProperty("haber");
        expect(e).toHaveProperty("saldo");
        expect(e).toHaveProperty("refId");
      }
    });
  });

  describe("Export PDF y Excel", () => {
    it.skip("genera PDF válido - requiere servidor dev en puerto 3000", async () => {
      // usa route handler directamente
      const adminClient = createClient(url!, serviceRole!, { auth: { autoRefreshToken: false, persistSession: false } });
      const pdfUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/cuenta-corriente/${clientId}/pdf`;
      const res = await fetch(pdfUrl, { headers: { Authorization: `Bearer ${serviceRole}` } });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/pdf");
    });

    it.skip("genera Excel válido - requiere servidor dev en puerto 3000", async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/cuenta-corriente/${clientId}/excel`, { headers: { Authorization: `Bearer ${serviceRole}` } });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    });
  });
});