"use client";

import { useActionState } from "react";
import { createChargeAction, type AccountingActionState } from "@/server/actions/accounting";

export function CreateChargeForm({ clientId, canCreate }: { clientId: string; canCreate: boolean }) {
  const [state, action, pending] = useActionState(createChargeAction, {} as AccountingActionState);

  if (!canCreate) return null;

  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <h2 className="text-lg font-semibold">Nuevo cargo</h2>
      <input type="hidden" name="clientId" value={clientId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Descripción</span>
          <input name="description" required className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Monto</span>
          <input name="amount" type="number" min={0} step="0.01" required className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Vencimiento (opcional)</span>
          <input name="dueDate" type="date" className="input" />
        </label>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Creando…" : "Crear cargo"}
      </button>
    </form>
  );
}
