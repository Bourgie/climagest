"use client";

import { useActionState, useState } from "react";
import { saveQuoteAction, type QuoteFormState } from "@/server/actions/quotes";
import { QUOTE_ITEM_TYPES } from "@/server/services/quotes";

export type QuoteClientOption = { id: string; name: string };
export type QuoteEquipmentOption = { id: string; label: string };
export type QuoteItemDraft = { description: string; type: string; quantity: number; unitPrice: number };

const TYPE_LABELS: Record<string, string> = {
  mano_obra: "Mano de obra",
  material: "Material",
  repuesto: "Repuesto",
};

export function QuoteForm({
  mode,
  clients,
  equipment,
  initial,
}: {
  mode: "create" | "edit";
  clients: QuoteClientOption[];
  equipment: QuoteEquipmentOption[];
  initial?: {
    id: string;
    serviceRequestId: string | null;
    clientId: string;
    equipmentId: string | null;
    items: QuoteItemDraft[];
    discount: number;
    paymentTerms: string;
    validUntil: string;
  };
}) {
  const [state, action, pending] = useActionState(saveQuoteAction, {} as QuoteFormState);
  const [items, setItems] = useState<QuoteItemDraft[]>(
    initial?.items ?? [{ description: "", type: "mano_obra", quantity: 1, unitPrice: 0 }],
  );

  function update(i: number, patch: Partial<QuoteItemDraft>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {mode === "edit" && initial && (
        <>
          <input type="hidden" name="quoteId" value={initial.id} />
          <input type="hidden" name="serviceRequestId" value={initial.serviceRequestId ?? ""} />
        </>
      )}
      {mode === "create" && (
        <input type="hidden" name="serviceRequestId" value={initial?.serviceRequestId ?? ""} />
      )}
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Cliente</span>
          <select name="clientId" required defaultValue={initial?.clientId} className="input">
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Equipo (opcional)</span>
          <select name="equipmentId" defaultValue={initial?.equipmentId ?? ""} className="input">
            <option value="">Sin equipo</option>
            {equipment.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="font-medium">Líneas</p>
          <button
            type="button"
            onClick={() =>
              setItems((p) => [...p, { description: "", type: "mano_obra", quantity: 1, unitPrice: 0 }])
            }
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
          >
            + Agregar línea
          </button>
        </div>
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-700 sm:grid-cols-5">
            <input
              placeholder="Descripción"
              value={it.description}
              onChange={(e) => update(i, { description: e.target.value })}
              className="input sm:col-span-2"
            />
            <select
              value={it.type}
              onChange={(e) => update(i, { type: e.target.value })}
              className="input"
            >
              {QUOTE_ITEM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="Cantidad"
              value={it.quantity}
              onChange={(e) => update(i, { quantity: Number(e.target.value) })}
              className="input"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Precio unit."
                value={it.unitPrice}
                onChange={(e) => update(i, { unitPrice: Number(e.target.value) })}
                className="input"
              />
              <button
                type="button"
                onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}
                className="text-sm text-red-600"
              >
                Quitar
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Descuento</span>
          <input
            type="number"
            min={0}
            step="0.01"
            name="discount"
            defaultValue={initial?.discount ?? 0}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Condiciones de pago</span>
          <input name="paymentTerms" defaultValue={initial?.paymentTerms} className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Válido hasta</span>
          <input name="validUntil" type="date" defaultValue={initial?.validUntil} className="input" />
        </label>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
