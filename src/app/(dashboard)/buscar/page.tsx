import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission, requireUser } from "@/server/auth";
import { globalSearch } from "@/server/services/search";

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/");
  if (user.forcePasswordChange) redirect("/cambiar-password");

  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const scopes = {
    clients: await hasPermission(user, "clients.view"),
    equipment: await hasPermission(user, "equipment.view"),
    serviceRequests: await hasPermission(user, "service_requests.view"),
    quotes: await hasPermission(user, "quotes.view"),
    workOrders: await hasPermission(user, "work_orders.view"),
    payments: await hasPermission(user, "charges.view"),
  };

  const results =
    query.length >= 2
      ? await globalSearch({
          admin: createAdminClient(),
          companyId: user.companyId,
          query,
          scopes,
        })
      : null;

  const empty =
    results &&
    results.clients.length === 0 &&
    results.equipment.length === 0 &&
    results.serviceRequests.length === 0 &&
    results.quotes.length === 0 &&
    results.workOrders.length === 0 &&
    results.payments.length === 0;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold">Búsqueda global</h1>

      <form action="/buscar" method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Cliente, teléfono, dirección, equipo, serie o Nº de documento…"
          minLength={2}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Buscar
        </button>
      </form>

      {results && empty && (
        <p className="text-sm text-zinc-500">Sin resultados para “{query}”.</p>
      )}

      {results && results.clients.length > 0 && (
        <Section title="Clientes">
          {results.clients.map((c) => (
            <Link key={c.id} href={`/clientes/${c.id}`} className="block rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
              {c.name}
            </Link>
          ))}
        </Section>
      )}

      {results && results.equipment.length > 0 && (
        <Section title="Equipos">
          {results.equipment.map((e) => (
            <Link key={e.id} href={`/equipos/${e.id}`} className="block rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
              {[e.brand, e.model].filter(Boolean).join(" ") || "Equipo"}
              {e.serial ? ` — serie ${e.serial}` : ""}
            </Link>
          ))}
        </Section>
      )}

      {results && results.serviceRequests.length > 0 && (
        <Section title="Pedidos">
          {results.serviceRequests.map((r) => (
            <Link key={r.id} href="/pedidos" className="block rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
              Pedido #{r.docNumber ?? "—"} — {r.status}
            </Link>
          ))}
        </Section>
      )}

      {results && results.quotes.length > 0 && (
        <Section title="Presupuestos">
          {results.quotes.map((r) => (
            <Link key={r.id} href={`/presupuestos/${r.id}`} className="block rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
              Presupuesto #{r.docNumber ?? "—"} — {r.status} — ${r.total.toFixed(2)}
            </Link>
          ))}
        </Section>
      )}

      {results && results.workOrders.length > 0 && (
        <Section title="Órdenes de trabajo">
          {results.workOrders.map((r) => (
            <Link key={r.id} href={`/ordenes/${r.id}`} className="block rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
              OT #{r.docNumber ?? "—"} — {r.status}
            </Link>
          ))}
        </Section>
      )}

      {results && results.payments.length > 0 && (
        <Section title="Pagos">
          {results.payments.map((r) => (
            <Link key={r.id} href={`/cuenta-corriente/${r.clientId}`} className="block rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
              Pago #{r.docNumber ?? "—"} — ${r.amount.toFixed(2)}
            </Link>
          ))}
        </Section>
      )}

      <Link href="/" className="text-sm text-zinc-500 underline">
        ← Volver al inicio
      </Link>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
