import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODULES, MODULE_PRESETS, type ModuleKey, type Plan } from "@/lib/modules";
import { UpdateCompanyForm } from "./update-company-form";
import { LogoutButton } from "@/app/logout-button";
import { Header } from "@/components/layout/Header";

export default async function EditarEmpresaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !user.isSuperuser) redirect("/login");

  const { id } = await params;
  const admin = createAdminClient();

  const { data: company } = await admin
    .from("companies")
    .select("id, name, company_code, status, plan")
    .eq("id", id)
    .maybeSingle();

  if (!company) redirect("/superadmin");

  const { data: modules } = await admin
    .from("company_modules")
    .select("module_key")
    .eq("company_id", id)
    .eq("enabled", true);

  const currentModules = new Set(modules?.map((m) => m.module_key) ?? []);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <Header user={{ role: "owner", isSuperuser: true, companyId: undefined }} />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Editar empresa</h1>
        <p className="text-sm text-zinc-500 mt-1">{company.name} ({company.company_code})</p>
      </div>

      <UpdateCompanyForm
        initialData={{
          name: company.name,
          companyCode: company.company_code,
          status: company.status,
          plan: company.plan,
          modules: currentModules,
        }}
      />

      <a href="/superadmin" className="text-sm text-zinc-500 underline">
        ← Volver al panel
      </a>
    </main>
  );
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} className="text-sm text-zinc-500 underline">{children}</a>;
}