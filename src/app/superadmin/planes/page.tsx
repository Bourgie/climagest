import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlanForm } from "./plan-form";
import { PlanRow } from "./plan-row";
import { LogoutButton } from "@/app/logout-button";
import { Header } from "@/components/layout/Header";

export default async function PlanesPage() {
  const user = await getCurrentUser();
  if (!user || !user.isSuperuser) redirect("/login");

  const admin = createAdminClient();
  const { data: plans } = await admin
    .from("plans")
    .select("id, key, name, description, price_monthly, price_yearly, features, is_active, sort_order")
    .order("sort_order");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <Header user={{ role: "owner", isSuperuser: true, companyId: undefined }} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Planes</h1>
          <p className="text-sm text-zinc-500 mt-1">Gestión de planes y módulos</p>
        </div>
        <PlanForm />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="text-left p-3 font-medium text-zinc-500">Plan</th>
              <th className="text-left p-3 font-medium text-zinc-500">Descripción</th>
              <th className="text-left p-3 font-medium text-zinc-500">Precio mensual</th>
              <th className="text-left p-3 font-medium text-zinc-500">Módulos</th>
              <th className="text-left p-3 font-medium text-zinc-500">Estado</th>
              <th className="text-left p-3 font-medium text-zinc-500">Orden</th>
              <th className="text-right p-3 font-medium text-zinc-500">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {plans?.map((p) => (
              <PlanRow key={p.id} plan={p} />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}