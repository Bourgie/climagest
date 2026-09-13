"use client";

import { useActionState } from "react";
import {
  respondToQuoteByTokenAction,
  type QuoteAcceptanceState,
} from "@/server/actions/quote-acceptance";

const TYPE_LABELS: Record<string, string> = {
  mano_obra: "Mano de obra",
  material: "Material",
  repuesto: "Repuesto",
};

export type AcceptanceQuote = {
  id: string;
  subtotal: number;
  discount: number;
  total: number;
  payment_terms: string | null;
  status: string;
  accepted_at: string | null;
  items: {
    id: string;
    description: string;
    type: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
};

export function AcceptanceView({
  token,
  quote,
}: {
  token: string;
  quote: AcceptanceQuote;
}) {
  const [state, action, pending] = useActionState(
    respondToQuoteByTokenAction,
    {} as QuoteAcceptanceState,
  );

  const isEnviado = quote.status === "enviado";
  const isAceptado = quote.status === "aceptado";
  const isRechazado = quote.status === "rechazado";

  return (
    <div className="flex flex-col gap-4">
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
          {quote.items.map((it) => (
            <tr key={it.id} className="border-t border-zinc-200 dark:border-zinc-700">
              <td className="py-1">{it.description}</td>
              <td className="py-1">{TYPE_LABELS[it.type] ?? it.type}</td>
              <td className="py-1 text-right">{it.quantity}</td>
              <td className="py-1 text-right">${it.unit_price.toFixed(2)}</td>
              <td className="py-1 text-right">${it.subtotal.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-col items-end gap-1 text-sm">
        <p>Subtotal: <strong>${quote.subtotal.toFixed(2)}</strong></p>
        {quote.discount > 0 && <p>Descuento: -${quote.discount.toFixed(2)}</p>}
        <p className="text-lg">Total: <strong>${quote.total.toFixed(2)}</strong></p>
      </div>

      {quote.payment_terms && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Condiciones: {quote.payment_terms}
        </p>
      )}

      {isEnviado && (
        <form action={action} className="flex flex-col gap-2">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            name="accept"
            value="true"
            disabled={pending}
            className="rounded-md bg-green-600 px-4 py-3 text-base font-medium text-white disabled:opacity-50"
          >
            Aceptar presupuesto
          </button>
          <button
            type="submit"
            name="accept"
            value="false"
            disabled={pending}
            className="rounded-md border border-red-300 px-4 py-3 text-base font-medium text-red-600 disabled:opacity-50"
          >
            Rechazar
          </button>
        </form>
      )}

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && (
        <p className="text-center text-green-600">Respuesta registrada. Gracias.</p>
      )}

      {isAceptado && (
        <p className="text-center text-green-600">
          Este presupuesto ya fue aceptado.
        </p>
      )}
      {isRechazado && (
        <p className="text-center text-red-600">Este presupuesto fue rechazado.</p>
      )}
    </div>
  );
}
