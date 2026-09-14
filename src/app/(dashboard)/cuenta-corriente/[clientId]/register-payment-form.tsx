"use client";

import { useActionState } from "react";
import { registerPaymentAction, type AccountingActionState } from "@/server/actions/accounting";

const METHODS = ["efectivo", "transferencia", "debito", "credito", "mercadopago", "otro"] as const;

export function RegisterPaymentForm({ clientId, canRegister }: { clientId: string; canRegister: boolean }) {
  const [state, action, pending] = useActionState(registerPaymentAction, {} as AccountingActionState);

  if (!canRegister) return null;

  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <h2 className="text-lg font-semibold">Registrar pago</h2>
      <input type="hidden" name="clientId" value={clientId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Monto</span>
          <input name="amount" type="number" min={0} step="0.01" required className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Método</span>
          <select name="method" className="input" defaultValue="efectivo">
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Fecha</span>
          <input name="paidAt" type="datetime-local" className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-3">
          <span className="font-medium">Notas</span>
          <input name="notes" className="input" />
        </label>
      </div>
      <p className="text-xs text-zinc-500">
        El pago NO se aplica automáticamente. Después elegí manualmente a qué cargos aplicarlo.
      </p>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Registrando…" : "Registrar pago"}
      </button>
    </form>
  );
}
