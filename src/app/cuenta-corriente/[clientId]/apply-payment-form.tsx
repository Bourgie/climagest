"use client";

import { useActionState } from "react";
import { applyPaymentAction, type AccountingActionState } from "@/server/actions/accounting";

export type ApplyPaymentOption = { id: string; label: string; remainder: number };
export type ApplyChargeOption = { id: string; label: string; balance: number };

export function ApplyPaymentForm({
  payments,
  charges,
}: {
  payments: ApplyPaymentOption[];
  charges: ApplyChargeOption[];
}) {
  const [state, action, pending] = useActionState(applyPaymentAction, {} as AccountingActionState);

  const availablePayments = payments.filter((p) => p.remainder > 0);
  const openCharges = charges.filter((c) => c.balance > 0);
  if (availablePayments.length === 0 || openCharges.length === 0) return null;

  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <h2 className="text-lg font-semibold">Aplicar pago a cargo (manual)</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Pago</span>
          <select name="paymentId" className="input">
            {availablePayments.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} (${p.remainder.toFixed(2)} disponible)
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Cargo</span>
          <select name="chargeId" className="input">
            {openCharges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} (${c.balance.toFixed(2)} adeuda)
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Monto a aplicar</span>
          <input name="amount" type="number" min={0} step="0.01" required className="input" />
        </label>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Aplicando…" : "Aplicar"}
      </button>
    </form>
  );
}
