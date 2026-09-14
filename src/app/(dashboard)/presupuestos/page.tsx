import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission, requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { LogoutButton } from "@/app/logout-button";

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  enviado: "Enviado",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
  vencido: "Vencido",
};

export default async function PresupuestosPage() {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/");

  const [canView, canCreate] = await Promise.all([
    hasPermission(user, "quotes.view"),
    hasPermission(user, "quotes.create"),
  ]);
  if (!canView) redirect("/");

  const admin = createAdminClient();
  const { data: quotes } = await admin
    .from("quotes")
    .select("id, client_id, total, status, created_at")
    .eq("company_id", user.companyId)
    .order("created_at", { ascending: false });

  const { data: clients } = await admin
    .from("clients")
    .select("id, name")
    .eq("company_id", user.companyId);
  const nameById = new Map((clients ?? []).map((c) => [c.id, c.name]));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Presupuestos</h1>
        <div className="flex items-center gap-3">
          {canCreate && (
            <Link
              href="/presupuestos/nuevo"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Nuevo presupuesto
            </Link>
          )}
          <LogoutButton />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        {quotes?.length === 0 && <p className="text-sm text-zinc-500">Sin presupuestos.</p>}
        {(quotes ?? []).map((q) => (
          <Link
            key={q.id}
            href={`/presupuestos/${q.id}`}
            className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <div className="flex flex-col gap-1">
              <p className="font-medium">{nameById.get(q.client_id) ?? "—"}</p>
              <p className="text-sm text-zinc-500">
                {STATUS_LABELS[q.status] ?? q.status}
              </p>
            </div>
            <p className="font-semibold">${Number(q.total).toFixed(2)}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
