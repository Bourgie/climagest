"use client";

import { useActionState } from "react";
import { deletePlanAction, type PlanActionState } from "@/server/actions/plans";

type Plan = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
};

export function PlanRow({ plan }: { plan: Plan }) {
  const [statusState, statusAction, statusPending] = useActionState(
    async (_prev: PlanActionState, formData: FormData) => {
      const res = await fetch("/api/superadmin/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: plan.id, is_active: formData.get("is_active") }),
      });
      return res.json();
    },
    {} as PlanActionState,
  );

  const [deleteState, deleteAction, deletePending] = useActionState(
    deletePlanAction,
    {} as PlanActionState,
  );

  const formatPrice = (n: number) => new Intl.NumberFormat("es-AR").format(n);

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800">
      <td className="p-3">
        <p className="font-medium">{plan.name}</p>
        <p className="text-xs text-zinc-500 font-mono">{plan.key}</p>
      </td>
      <td className="p-3 text-zinc-600 dark:text-zinc-400">
        {plan.description ?? "—"}
      </td>
      <td className="p-3">
        <p>${formatPrice(plan.price_monthly)}/mes</p>
        {plan.price_yearly > 0 && (
          <p className="text-xs text-zinc-500">${formatPrice(plan.price_yearly)}/año</p>
        )}
      </td>
      <td className="p-3">
        <div className="flex flex-wrap gap-1">
          {plan.features.map((f) => (
            <span key={f} className="inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800">
              {f}
            </span>
          ))}
        </div>
      </td>
      <td className="p-3">
        <form action={async (formData) => {
          const res = await fetch("/api/superadmin/plans", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: plan.id, is_active: formData.get("is_active") === "true" }),
          });
          return res.json();
        }} className="flex items-center gap-2">
          <input type="hidden" name="id" value={plan.id} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="is_active"
              checked={plan.is_active}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="rounded border-zinc-300 text-zinc-600"
            />
            <span className="text-sm">{plan.is_active ? "Activo" : "Inactivo"}</span>
          </label>
        </form>
      </td>
      <td className="p-3 text-sm text-zinc-500">{plan.sort_order}</td>
      <td className="p-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <a
            href={`/superadmin/planes/editar/${plan.id}`}
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            Editar
          </a>
          <form action={deleteAction} className="inline">
            <input type="hidden" name="id" value={plan.id} />
            <button
              type="submit"
              disabled={deletePending}
              className="text-sm text-red-600 hover:text-red-900 disabled:opacity-50"
            >
              Eliminar
            </button>
            {deleteState?.error && <p className="text-sm text-red-600">{deleteState.error}</p>}
          </form>
        </div>
      </td>
    </tr>
  );
}