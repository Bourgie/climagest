"use client";

import { deletePaymentAction } from "@/server/actions/accounting";

export type PaymentRowData = {
  id: string;
  amount: number;
  method: string;
  paid_at: string;
  notes: string | null;
  remainder: number;
};

export function PaymentRow({
  payment,
  canDelete,
}: {
  payment: PaymentRowData;
  canDelete: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
      <div>
        <p className="font-medium">
          ${payment.amount.toFixed(2)} · {payment.method}
        </p>
        <p className="text-sm text-zinc-500">
          {new Date(payment.paid_at).toLocaleString("es-AR")}
          {payment.notes ? ` · ${payment.notes}` : ""}
        </p>
        <p className="text-sm">Sin aplicar: ${payment.remainder.toFixed(2)}</p>
      </div>
      {canDelete && (
        <form action={deletePaymentAction}>
          <input type="hidden" name="paymentId" value={payment.id} />
          <button className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600">
            Eliminar
          </button>
        </form>
      )}
    </div>
  );
}
