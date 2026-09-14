import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission, requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { LogoutButton } from "@/app/logout-button";

export default async function CuentaCorrientePage() {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/");
  if (!(await hasPermission(user, "charges.view"))) redirect("/");

  const admin = createAdminClient();

  const { data: clients } = await admin
    .from("clients")
    .select("id, name")
    .eq("company_id", user.companyId)
    .order("name");

  const { data: charges } = await admin
    .from("account_charges")
    .select("client_id, amount, late_fee_amount")
    .eq("company_id", user.companyId);

  const { data: payments } = await admin
    .from("payments")
    .select("client_id, amount")
    .eq("company_id", user.companyId);

  const balanceByClient = new Map<string, number>();
  for (const c of charges ?? []) {
    const owed = Number(c.amount) + Number(c.late_fee_amount);
    balanceByClient.set(c.client_id, (balanceByClient.get(c.client_id) ?? 0) + owed);
  }
  for (const p of payments ?? []) {
    balanceByClient.set(p.client_id, (balanceByClient.get(p.client_id) ?? 0) - Number(p.amount));
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cuenta corriente</h1>
        <LogoutButton />
      </div>

      <section className="flex flex-col gap-3">
        {clients?.length === 0 && <p className="text-sm text-zinc-500">Sin clientes.</p>}
        {(clients ?? []).map((c) => {
          const balance = Math.round((balanceByClient.get(c.id) ?? 0) * 100) / 100;
          return (
            <Link
              key={c.id}
              href={`/cuenta-corriente/${c.id}`}
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <p className="font-medium">{c.name}</p>
              <p className={`font-semibold ${balance > 0 ? "text-red-600" : "text-green-600"}`}>
                ${balance.toFixed(2)}
              </p>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
