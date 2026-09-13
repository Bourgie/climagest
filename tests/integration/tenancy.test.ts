import { config as loadEnv } from "dotenv";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Carga .env.local (Supabase URL, anon key, service_role key).
loadEnv({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

const run = describe.skipIf(!url || !anon || !serviceRole);

run("Aislamiento multiempresa (RLS)", () => {
  const suffix = Date.now().toString(36).toUpperCase();
  const codeA = `TSTA${suffix}`.slice(0, 8);
  const codeB = `TSTB${suffix}`.slice(0, 8);

  const admin = createClient(url!, serviceRole!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let companyA: string;
  let companyB: string;
  let userIdA: string;
  let userIdB: string;
  // Client tipados `any`: el test corre contra un schema sin tipos generados.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let clientA: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let clientB: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let anonClient: any;

  function userClient(token: string) {
    return createClient(url!, anon!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  }

  async function signInToken(email: string, password: string) {
    // Client descartable solo para el sign-in (no reutiliza el anonClient).
    const signIn = createClient(url!, anon!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await signIn.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(`signIn ${email}: ${error.message}`);
    return data.session.access_token;
  }

  beforeAll(async () => {
    const pwd = "Test1234!";
    const emailA = `ownera${suffix.toLowerCase()}@internal.app`;
    const emailB = `ownerb${suffix.toLowerCase()}@internal.app`;

    // Empresas
    const a = await admin
      .from("companies")
      .insert({ name: "A", company_code: codeA, status: "active" })
      .select("id")
      .single();
    if (a.error) throw new Error(`company A: ${a.error.message}`);
    companyA = a.data.id;

    const b = await admin
      .from("companies")
      .insert({ name: "B", company_code: codeB, status: "active" })
      .select("id")
      .single();
    if (b.error) throw new Error(`company B: ${b.error.message}`);
    companyB = b.data.id;

    // Usuarios (owner de cada empresa)
    const ua = await admin.auth.admin.createUser({
      email: emailA,
      password: pwd,
      email_confirm: true,
    });
    if (ua.error) throw new Error(`user A: ${ua.error.message}`);
    userIdA = ua.data.user.id;

    const ub = await admin.auth.admin.createUser({
      email: emailB,
      password: pwd,
      email_confirm: true,
    });
    if (ub.error) throw new Error(`user B: ${ub.error.message}`);
    userIdB = ub.data.user.id;

    await admin.from("profiles").insert([
      { id: userIdA, full_name: "Owner A", username: `ownera${suffix.toLowerCase()}`, internal_email: emailA },
      { id: userIdB, full_name: "Owner B", username: `ownerb${suffix.toLowerCase()}`, internal_email: emailB },
    ]);
    await admin.from("memberships").insert([
      { user_id: userIdA, company_id: companyA, role: "owner" },
      { user_id: userIdB, company_id: companyB, role: "owner" },
    ]);
    await admin.rpc("seed_default_role_permissions", { p_company_id: companyA });
    await admin.rpc("seed_default_role_permissions", { p_company_id: companyB });

    anonClient = createClient(url!, anon!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    clientA = userClient(await signInToken(emailA, pwd));
    clientB = userClient(await signInToken(emailB, pwd));
  });

  afterAll(async () => {
    if (userIdA) await admin.auth.admin.deleteUser(userIdA);
    if (userIdB) await admin.auth.admin.deleteUser(userIdB);
    if (companyA) await admin.from("companies").delete().eq("id", companyA);
    if (companyB) await admin.from("companies").delete().eq("id", companyB);
  });

  it("usuario A ve su empresa pero no la de B", async () => {
    const { data: a } = await clientA.from("companies").select("id");
    const ids = ((a ?? []) as { id: string }[]).map((r) => r.id);
    expect(ids).toContain(companyA);
    expect(ids).not.toContain(companyB);
  });

  it("usuario B ve su empresa pero no la de A", async () => {
    const { data: b } = await clientB.from("companies").select("id");
    const ids = ((b ?? []) as { id: string }[]).map((r) => r.id);
    expect(ids).toContain(companyB);
    expect(ids).not.toContain(companyA);
  });

  it("usuario A no ve memberships de la empresa B", async () => {
    const { data } = await clientA.from("memberships").select("company_id");
    const companyIds = ((data ?? []) as { company_id: string }[]).map(
      (r) => r.company_id,
    );
    expect(companyIds).toContain(companyA);
    expect(companyIds).not.toContain(companyB);
  });

  it("usuario A no ve role_permissions de la empresa B", async () => {
    const { data } = await clientA.from("role_permissions").select("company_id");
    const companyIds = ((data ?? []) as { company_id: string }[]).map(
      (r) => r.company_id,
    );
    expect(companyIds).toContain(companyA);
    expect(companyIds).not.toContain(companyB);
  });

  it("usuario A solo lee su propio profile (no el de B)", async () => {
    const { data } = await clientA.from("profiles").select("id");
    const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
    expect(ids).toContain(userIdA);
    expect(ids).not.toContain(userIdB);
  });

  it("anon no lee empresas ni memberships", async () => {
    const { data: companies } = await anonClient.from("companies").select("id");
    expect(companies ?? []).toHaveLength(0);

    const { data: memberships } = await anonClient.from("memberships").select("id");
    expect(memberships ?? []).toHaveLength(0);
  });

  it("anon no puede ejecutar funciones de escritura (seed_default_role_permissions)", async () => {
    const { error } = await anonClient.rpc("seed_default_role_permissions", {
      p_company_id: companyA,
    });
    expect(error).toBeTruthy();
    expect(error.code).toBe("42501");
  });
});
