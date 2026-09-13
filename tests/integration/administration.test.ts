import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { updateRolePermissions } from "@/server/services/permissions";
import { createCompany } from "@/server/services/superadmin";
import {
  createCompanyUser,
  resetUserPassword,
  updateCompanyUser,
} from "@/server/services/users";

loadEnv({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

const run = describe.skipIf(!url || !serviceRole);

run("Administración y permisos (Fase 2)", () => {
  const suffix = Date.now().toString(36).toUpperCase();
  const code = `TST${suffix}`.slice(0, 8);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createClient(url!, serviceRole!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let companyId: string;
  let actorId: string;
  const createdUsers: string[] = [];
  const createdCompanies: string[] = [];

  async function makeUser(username: string, role: string, companyCode: string) {
    const email = `${username}+${companyCode.toLowerCase()}@internal.app`;
    const { data } = await admin.auth.admin.createUser({
      email,
      password: "Test1234!",
      email_confirm: true,
    });
    await admin.from("profiles").insert({
      id: data.user.id,
      full_name: username,
      username,
      internal_email: email,
    });
    return data.user.id;
  }

  beforeAll(async () => {
    const company = await admin
      .from("companies")
      .insert({ name: "Test", company_code: code, status: "trial", plan: "basico" })
      .select("id")
      .single();
    companyId = company.data.id;
    createdCompanies.push(companyId);

    actorId = await makeUser("actor", "owner", code);
    createdUsers.push(actorId);
    await admin.from("memberships").insert({
      user_id: actorId,
      company_id: companyId,
      role: "owner",
      status: "active",
    });
    await admin.rpc("seed_default_role_permissions", { p_company_id: companyId });
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

  it("createCompanyUser deniega sin permiso (canCreate=false)", async () => {
    const result = await createCompanyUser({
      admin,
      company: { id: companyId, code },
      actorUserId: actorId,
      canCreate: false,
      input: { fullName: "X", username: "x", role: "technician", password: "Test1234!" },
    });
    expect(result.ok).toBe(false);
  });

  it("createCompanyUser crea usuario con permiso", async () => {
    const result = await createCompanyUser({
      admin,
      company: { id: companyId, code },
      actorUserId: actorId,
      canCreate: true,
      input: { fullName: "Técnico T", username: "tec", role: "technician", password: "Test1234!" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      createdUsers.push(result.userId!);
      const { data: membership } = await admin
        .from("memberships")
        .select("role, company_id")
        .eq("user_id", result.userId)
        .single();
      expect(membership.role).toBe("technician");
      expect(membership.company_id).toBe(companyId);
    }
  });

  it("createCompanyUser rechaza username duplicado", async () => {
    const result = await createCompanyUser({
      admin,
      company: { id: companyId, code },
      actorUserId: actorId,
      canCreate: true,
      input: { fullName: "Dup", username: "tec", role: "admin", password: "Test1234!" },
    });
    expect(result.ok).toBe(false);
  });

  it("updateRolePermissions deniega sin permiso", async () => {
    const result = await updateRolePermissions({
      admin,
      companyId,
      actorUserId: actorId,
      canUpdate: false,
      role: "admin",
      entries: [{ key: "clients.delete", allowed: true }],
    });
    expect(result.ok).toBe(false);
  });

  it("updateRolePermissions actualiza la matriz con permiso", async () => {
    const result = await updateRolePermissions({
      admin,
      companyId,
      actorUserId: actorId,
      canUpdate: true,
      role: "admin",
      entries: [{ key: "clients.delete", allowed: true }],
    });
    expect(result.ok).toBe(true);

    const { data } = await admin
      .from("role_permissions")
      .select("allowed")
      .eq("company_id", companyId)
      .eq("role", "admin")
      .eq("permission_key", "clients.delete")
      .single();
    expect(data.allowed).toBe(true);
  });

  it("resetUserPassword niega si el target no es de la empresa", async () => {
    const otherCode = `${code}B`;
    const other = await createCompany({
      admin,
      actorUserId: actorId,
      input: {
        name: "Other",
        companyCode: otherCode,
        status: "trial",
        plan: "basico",
        modules: ["clientes"],
        owner: { fullName: "Owner B", username: "ownerb", password: "Test1234!" },
      },
    });
    expect(other.ok).toBe(true);
    if (other.ok) {
      const { data: otherCompany } = await admin
        .from("companies")
        .select("id")
        .eq("company_code", otherCode)
        .single();
      createdCompanies.push(otherCompany.id);
      createdUsers.push(other.userId!);

      // other.userId es el Dueño de la empresa B; intento resetearlo desde la empresa A.
      const result = await resetUserPassword({
        admin,
        company: { id: companyId },
        actorUserId: actorId,
        canReset: true,
        targetUserId: other.userId!,
        newPassword: "Nuevo123!",
      });
      expect(result.ok).toBe(false);
    }
  });

  it("createCompany (superadmin) crea empresa + módulos + dueño", async () => {
    const result = await createCompany({
      admin,
      actorUserId: actorId,
      input: {
        name: "Nueva SA",
        companyCode: `${code}C`,
        status: "active",
        plan: "profesional",
        modules: ["clientes", "agenda", "cuenta_corriente"],
        owner: { fullName: "Dueño Nuevo", username: "duenonuevo", password: "Test1234!" },
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const { data: company } = await admin
        .from("companies")
        .select("id")
        .eq("company_code", `${code}C`)
        .single();
      createdCompanies.push(company.id);
      createdUsers.push(result.userId!);

      const { data: modules } = await admin
        .from("company_modules")
        .select("module_key")
        .eq("company_id", company.id)
        .eq("enabled", true);
      expect(
        (modules as { module_key: string }[]).map((m) => m.module_key).sort(),
      ).toEqual(["clientes", "agenda", "cuenta_corriente"].sort());

      const { data: ownerPerm } = await admin
        .from("role_permissions")
        .select("allowed")
        .eq("company_id", company.id)
        .eq("role", "owner")
        .eq("permission_key", "users.reset_password")
        .single();
      expect(ownerPerm.allowed).toBe(true);
    }
  });

  it("resetUserPassword niega resetear al Dueño de la misma empresa", async () => {
    // actorId es el Dueño (owner) de companyId.
    const result = await resetUserPassword({
      admin,
      company: { id: companyId },
      actorUserId: actorId,
      canReset: true,
      targetUserId: actorId,
      newPassword: "Nuevo123!",
    });
    expect(result.ok).toBe(false);
  });

  it("updateCompanyUser deniega editar al Dueño", async () => {
    const result = await updateCompanyUser({
      admin,
      company: { id: companyId },
      actorUserId: actorId,
      canUpdate: true,
      targetUserId: actorId,
      input: { role: "technician" },
    });
    expect(result.ok).toBe(false);
  });
});
