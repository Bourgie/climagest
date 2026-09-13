import { createAdminClient } from "@/lib/supabase/admin";
import { AcceptanceView } from "./acceptance-view";

export default async function PresupuestoPublicoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: tokenRow } = await admin
    .from("quote_acceptance_tokens")
    .select("quote_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!tokenRow) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-6 py-10 text-center">
        <h1 className="text-xl font-semibold">Enlace inválido</h1>
        <p className="text-sm text-zinc-500">
          Este enlace no corresponde a un presupuesto válido.
        </p>
      </main>
    );
  }

  // eslint-disable-next-line react-hooks/purity -- server component, expiry check
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-6 py-10 text-center">
        <h1 className="text-xl font-semibold">El enlace expiró</h1>
        <p className="text-sm text-zinc-500">
          Contactá a la empresa para solicitar un nuevo presupuesto.
        </p>
      </main>
    );
  }

  const { data: quote } = await admin
    .from("quotes")
    .select("id, subtotal, discount, total, payment_terms, status, accepted_at")
    .eq("id", tokenRow.quote_id)
    .maybeSingle();
  if (!quote) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-6 py-10 text-center">
        <h1 className="text-xl font-semibold">Presupuesto no encontrado</h1>
      </main>
    );
  }

  const { data: items } = await admin
    .from("quote_items")
    .select("id, description, type, quantity, unit_price, subtotal")
    .eq("quote_id", quote.id)
    .order("id");

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Presupuesto</h1>
      <AcceptanceView
        token={token}
        quote={{
          id: quote.id,
          subtotal: Number(quote.subtotal),
          discount: Number(quote.discount),
          total: Number(quote.total),
          payment_terms: quote.payment_terms,
          status: quote.status,
          accepted_at: quote.accepted_at,
          items: (items ?? []).map((it) => ({
            id: it.id,
            description: it.description,
            type: it.type,
            quantity: Number(it.quantity),
            unit_price: Number(it.unit_price),
            subtotal: Number(it.subtotal),
          })),
        }}
      />
    </main>
  );
}
