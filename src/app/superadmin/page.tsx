import { requireSuperuser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CompanyRow, type CompanyRowData } from "./company-row";
import { CreateCompanyForm } from "./create-company-form";
import { LogoutButton } from "@/app/logout-button";
import Link from "next/link";

export default async function SuperadminPage() {
  await requireSuperuser();
  const admin = createAdminClient();

  const { data: companies } = await admin
    .from("companies")
    .select("id, name, company_code, status, plan, created_at")
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

  const totalCompanies = rows.length;
  const activeCompanies = rows.filter((r) => r.status === "active").length;
  const trialCompanies = rows.filter((r) => r.status === "trial").length;
  const suspendedCompanies = rows.filter((r) => r.status === "suspended").length;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Panel de Superusuario</h1>
          <p className="text-sm text-zinc-500 mt-1">Gestión completa de la plataforma</p>
        </div>
        <LogoutButton />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total empresas" value={totalCompanies} />
        <MetricCard title="Activas" value={activeCompanies} variant="success" />
        <MetricCard title="Prueba" value={trialCompanies} variant="info" />
        <MetricCard title="Suspendidas" value={suspendedCompanies} variant="warning" />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Empresas ({rows.length})</h2>
          <Link
            href="/superadmin/empresas/nueva"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + Nueva empresa
          </Link>
        </div>

        {rows.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-zinc-500">No hay empresas registradas.</p>
            <Link
              href="/superadmin/empresas/nueva"
              className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Crear primera empresa
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((c) => (
              <CompanyRow key={c.id} company={c} />
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Link
          href="/superadmin/planes"
          className="rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
        >
          <h3 className="font-semibold mb-1">Planes</h3>
          <p className="text-sm text-zinc-500">Gestionar planes y módulos por plan</p>
        </Link>
        <Link
          href="/superadmin/auditoria"
          className="rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
        >
          <h3 className="font-semibold mb-1">Auditoría</h3>
          <p className="text-sm text-zinc-500">Logs de acciones de la plataforma</p>
        </Link>
        <Link
          href="/superadmin/configuracion"
          className="rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
        >
          <h3 className="font-semibold mb-1">Configuración</h3>
          <p className="text-sm text-zinc-500">SMTP global, límites, feature flags</p>
        </Link>
        <Link
          href="/superadmin/perfil"
          className="rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
        >
          <h3 className="font-semibold mb-1">Mi perfil</h3>
          <p className="text-sm text-zinc-500">Email, contraseña, nombre</p>
        </Link>
      </div>
    </main>
  );
}

function MetricCard({ title, value, variant }: { title: string; value: number; variant?: "default" | "success" | "info" | "warning" }) {
  const variants = {
    default: "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
    success: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-900/20",
    info: "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-900/20",
    warning: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20",
  };
  return (
    <div className={`rounded-lg border p-4 ${variants[variant ?? "default"]}`}>
      <p className="text-3xl font-bold text-zinc-900 dark:text-white">{value}</p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{title}</p>
    </div>
  );
}