"use client";

import { useActionState } from "react";
import {
  applyLateFeeAction,
  deleteChargeAction,
  type AccountingActionState,
} from "@/server/actions/accounting";

export type ChargeRowData = {
  id: string;
  description: string;
  amount: number;
  late_fee_amount: number;
  due_date: string | null;
  status: string;
  balance: number;
};

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  parcial: "Parcial",
  pagado: "Pagado",
  vencido: "Vencido",
};

export function ChargeRow({
  charge,
  isOwner,
  canDelete,
}: {
  charge: ChargeRowData;
  isOwner: boolean;
  canDelete: boolean;
}) {
  const [moraState, moraAction, moraPending] = useActionState(
    applyLateFeeAction,
    {} as AccountingActionState,
  );

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{charge.description}</p>
          <p className="text-sm text-zinc-500">
            ${charge.amount.toFixed(2)}
            {charge.late_fee_amount > 0 && ` + mora $${charge.late_fee_amount.toFixed(2)}`} ·{" "}
            {STATUS_LABELS[charge.status] ?? charge.status}
            {charge.due_date ? ` · vence ${charge.due_date}` : ""}
          </p>
          <p className="text-sm font-medium">Saldo: ${charge.balance.toFixed(2)}</p>
        </div>
        {canDelete && (
          <form action={deleteChargeAction}>
            <input type="hidden" name="chargeId" value={charge.id} />
            <button className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600">
              Eliminar
            </button>
          </form>
        )}
      </div>

      {isOwner && charge.balance > 0 && (
        <form action={moraAction} className="flex items-center gap-2">
          <input type="hidden" name="chargeId" value={charge.id} />
          <input
            name="amount"
            type="number"
            min={0}
            step="0.01"
            placeholder="Recargo por mora"
            required
            className="input !w-auto flex-1"
          />
          <button
            type="submit"
            disabled={moraPending}
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm"
          >
            Aplicar mora
          </button>
        </form>
      )}
      {moraState?.error && <p className="text-sm text-red-600">{moraState.error}</p>}
    </div>
  );
}
