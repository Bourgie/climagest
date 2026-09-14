import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasPermission, requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { QuoteForm, type QuoteClientOption, type QuoteEquipmentOption, type QuoteItemDraft } from "../quote-form";
import { deleteQuoteAction, respondQuoteAction, sendQuoteAction } from "@/server/actions/quotes";

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  enviado: "Enviado",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
  vencido: "Vencido",
};
const TYPE_LABELS: Record<string, string> = {
  mano_obra: "Mano de obra",
  material: "Material",
  repuesto: "Repuesto",
};

export default async function PresupuestoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/");

  const [canView, canUpdate, canDelete, canSend] = await Promise.all([
    hasPermission(user, "quotes.view"),
    hasPermission(user, "quotes.update"),
    hasPermission(user, "quotes.delete"),
    hasPermission(user, "quotes.send"),
  ]);
  if (!canView) redirect("/presupuestos");

  const admin = createAdminClient();
  const { data: quote } = await admin
    .from("quotes")
    .select("*")
    .eq("id", id)
    .eq("company_id", user.companyId)
    .maybeSingle();
  if (!quote) notFound();

  const { data: items } = await admin
    .from("quote_items")
    .select("id, description, type, quantity, unit_price, subtotal")
    .eq("quote_id", id)
    .order("id");

  const { data: tokenRow } = await admin
    .from("quote_acceptance_tokens")
    .select("token")
    .eq("quote_id", id)
    .maybeSingle();

  const { data: client } = await admin
    .from("clients")
    .select("name")
    .eq("id", quote.client_id)
    .maybeSingle();

  const { data: clients } = await admin
    .from("clients")
    .select("id, name")
    .eq("company_id", user.companyId)
    .order("name");
  const { data: equipment } = await admin
    .from("equipment")
    .select("id, brand, model")
    .eq("company_id", user.companyId);

  const clientOptions: QuoteClientOption[] = (clients ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const equipmentOptions: QuoteEquipmentOption[] = (equipment ?? []).map((e) => ({
    id: e.id,
    label: `${e.brand ?? ""} ${e.model ?? ""}`.trim() || "Equipo",
  }));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const isDraft = quote.status === "draft";
  const isEnviado = quote.status === "enviado";

  const initial = {
    id: quote.id,
    serviceRequestId: quote.service_request_id,
    clientId: quote.client_id,
    equipmentId: quote.equipment_id,
    items: (items ?? []).map(
      (it): QuoteItemDraft => ({
        description: it.description,
        type: it.type,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unit_price),
      }),
    ),
    discount: Number(quote.discount),
    paymentTerms: quote.payment_terms ?? "",
    validUntil: quote.valid_until ?? "",
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/presupuestos" className="text-sm text-zinc-500">
            ← Volver
          </Link>
          <h1 className="text-2xl font-semibold">
            {client?.name ?? "Presupuesto"}
          </h1>
        </div>
        <span className="rounded-md bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-800">
          {STATUS_LABELS[quote.status] ?? quote.status}
        </span>
        <a
          href={`/api/presupuestos/${quote.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
        >
          PDF
        </a>
      </div>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="py-1">Descripción</th>
              <th className="py-1">Tipo</th>
              <th className="py-1 text-right">Cant.</th>
              <th className="py-1 text-right">Unit.</th>
              <th className="py-1 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((it) => (
              <tr key={it.id} className="border-t border-zinc-200 dark:border-zinc-700">
                <td className="py-1">{it.description}</td>
                <td className="py-1">{TYPE_LABELS[it.type] ?? it.type}</td>
                <td className="py-1 text-right">{Number(it.quantity)}</td>
                <td className="py-1 text-right">${Number(it.unit_price).toFixed(2)}</td>
                <td className="py-1 text-right">${Number(it.subtotal).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex flex-col items-end gap-1 text-sm">
          <p>Subtotal: <strong>${Number(quote.subtotal).toFixed(2)}</strong></p>
          {Number(quote.discount) > 0 && (
            <p>Descuento: -${Number(quote.discount).toFixed(2)}</p>
          )}
          <p className="text-lg">Total: <strong>${Number(quote.total).toFixed(2)}</strong></p>
        </div>
      </section>

      {isDraft && canSend && (
        <form action={sendQuoteAction}>
          <input type="hidden" name="quoteId" value={quote.id} />
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Enviar presupuesto
          </button>
        </form>
      )}

      {isEnviado && tokenRow && (
        <section className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <p className="font-medium">Enlace de aceptación para el cliente</p>
          <p className="font-mono text-xs break-all">
            {appUrl}/presupuesto/{tokenRow.token}
          </p>
          {canUpdate && (
            <div className="mt-2 flex gap-2">
              <form action={respondQuoteAction}>
                <input type="hidden" name="quoteId" value={quote.id} />
                <input type="hidden" name="accept" value="true" />
                <button className="rounded-md bg-green-600 px-3 py-1 text-sm text-white">
                  Aceptar
                </button>
              </form>
              <form action={respondQuoteAction}>
                <input type="hidden" name="quoteId" value={quote.id} />
                <input type="hidden" name="accept" value="false" />
                <button className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600">
                  Rechazar
                </button>
              </form>
            </div>
          )}
        </section>
      )}

      {quote.status === "aceptado" && quote.accepted_at && (
        <p className="text-sm text-green-600">
          Aceptado el {new Date(quote.accepted_at).toLocaleDateString("es-AR")}.
        </p>
      )}
      {quote.status === "rechazado" && (
        <p className="text-sm text-red-600">Rechazado.</p>
      )}

      {isDraft && canUpdate && (
        <>
          <h2 className="text-lg font-semibold">Editar</h2>
          <QuoteForm
            mode="edit"
            clients={clientOptions}
            equipment={equipmentOptions}
            initial={initial}
          />
          {canDelete && (
            <form action={deleteQuoteAction}>
              <input type="hidden" name="quoteId" value={quote.id} />
              <button className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600">
                Eliminar presupuesto
              </button>
            </form>
          )}
        </>
      )}
    </main>
  );
}
