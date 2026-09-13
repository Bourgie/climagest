// Seed de desarrollo (SOLO dev, nunca datos reales).
// Crea: superusuario de plataforma + empresa demo + dueño/admin/técnico demo,
// y siembra role_permissions por defecto.
// Uso: node --env-file=.env.local scripts/seed-dev.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  console.error(
    "Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Corré con: node --env-file=.env.local scripts/seed-dev.mjs",
  );
  process.exit(1);
}

const admin = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SUPER_EMAIL = "superadmin@internal.app";
const SUPER_PASSWORD = process.env.SEED_SUPERUSER_PASSWORD || "SuperAdmin123!";

const DEMO_CODE = "DEMO";
const DEMO_NAME = "Empresa Demo";
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "Demo1234!";

function internalEmail(username, companyCode) {
  return `${username.toLowerCase()}+${companyCode.toLowerCase()}@internal.app`;
}

async function findOrCreateAuthUser(email, password) {
  const { data } = await admin.auth.admin.listUsers();
  const found = data.users.find((u) => u.email === email);
  if (found) {
    console.log(`[auth] ya existe ${email}`);
    return found;
  }
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  console.log(`[auth] creado ${email}`);
  return created.user;
}

async function upsertProfile({
  id,
  fullName,
  username,
  email,
  isSuperuser,
  forcePasswordChange = false,
}) {
  const { error } = await admin.from("profiles").upsert(
    {
      id,
      full_name: fullName,
      username: username.toLowerCase(),
      internal_email: email,
      is_superuser: isSuperuser,
      force_password_change: forcePasswordChange,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(`profile ${username}: ${error.message}`);
  console.log(`[profile] ${username} ok`);
}

async function upsertMembership(userId, companyId, role) {
  const { error } = await admin.from("memberships").upsert(
    { user_id: userId, company_id: companyId, role, status: "active" },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`membership ${role}: ${error.message}`);
  console.log(`[membership] ${role} ok`);
}

async function createCompanyUser({ username, fullName, companyId, companyCode, role }) {
  const email = internalEmail(username, companyCode);
  const authUser = await findOrCreateAuthUser(email, DEMO_PASSWORD);
  await upsertProfile({
    id: authUser.id,
    fullName,
    username,
    email,
    isSuperuser: false,
    forcePasswordChange: false,
  });
  await upsertMembership(authUser.id, companyId, role);
}

async function main() {
  // 1. Superusuario (plataforma)
  const superUser = await findOrCreateAuthUser(SUPER_EMAIL, SUPER_PASSWORD);
  await upsertProfile({
    id: superUser.id,
    fullName: "Superadmin",
    username: "superadmin",
    email: SUPER_EMAIL,
    isSuperuser: true,
  });

  // 2. Empresa demo
  let companyId;
  const { data: existing } = await admin
    .from("companies")
    .select("id")
    .eq("company_code", DEMO_CODE)
    .maybeSingle();
  if (existing) {
    companyId = existing.id;
    console.log(`[company] ya existe ${DEMO_CODE}`);
  } else {
    const { data, error } = await admin
      .from("companies")
      .insert({
        name: DEMO_NAME,
        company_code: DEMO_CODE,
        status: "trial",
        plan: "profesional",
      })
      .select("id")
      .single();
    if (error) throw new Error(`company: ${error.message}`);
    companyId = data.id;
    console.log(`[company] creado ${DEMO_CODE}`);
  }

  // 3. role_permissions por defecto (Dueño/Admin/Técnico)
  const { error: seedErr } = await admin.rpc("seed_default_role_permissions", {
    p_company_id: companyId,
  });
  if (seedErr) throw new Error(`seed role_permissions: ${seedErr.message}`);
  console.log("[role_permissions] defaults ok");

  // 4. Usuarios demo
  await createCompanyUser({
    username: "demo",
    fullName: "Dueño Demo",
    companyId,
    companyCode: DEMO_CODE,
    role: "owner",
  });
  await createCompanyUser({
    username: "admin",
    fullName: "Administrativo Demo",
    companyId,
    companyCode: DEMO_CODE,
    role: "admin",
  });
  await createCompanyUser({
    username: "tecnico",
    fullName: "Técnico Demo",
    companyId,
    companyCode: DEMO_CODE,
    role: "technician",
  });

  console.log("\n=== Seed completado ===");
  console.log("Login demo (código de empresa: DEMO):");
  console.log(`  demo    / ${DEMO_PASSWORD}   (Dueño)`);
  console.log(`  admin   / ${DEMO_PASSWORD}   (Administrativo)`);
  console.log(`  tecnico / ${DEMO_PASSWORD}   (Técnico)`);
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
