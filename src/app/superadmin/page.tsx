import { requireSuperuser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CompanyRow, type CompanyRowData } from "./company-row";
import { CreateCompanyForm } from "./create-company-form";
import { LogoutButton } from "@/app/logout-button";

export default async function SuperadminPage() {
  await requireSuperuser();
  const admin = createAdminClient();

  const { data: companies } = await admin
    .from("companies")
    .select("id, name, company_code, status, plan")
    .order("created_at", { ascending: false });

  const { data: modules } = await admin
    .from("company_modules")
    .select("company_id, module_key")
    .eq("enabled", true);

  const moduleMap = new Map<string, string[]>();
  for (const m of modules ?? []) {
    const list = moduleMap.get(m.company_id) ?? [];
    list.push(m.module_key);
    moduleMap.set(m.company_id, list);
  }

  const rows: CompanyRowData[] = (companies ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    company_code: c.company_code,
    status: c.status,
    plan: c.plan,
    modules: moduleMap.get(c.id) ?? [],
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Panel de Superusuario</h1>
        <LogoutButton />
      </div>

      <CreateCompanyForm />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Empresas ({rows.length})</h2>
        {rows.length === 0 && <p className="text-sm text-zinc-500">Sin empresas.</p>}
        {rows.map((c) => (
          <CompanyRow key={c.id} company={c} />
        ))}
      </section>
    </main>
  );
}
