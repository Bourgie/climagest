"use client";

import { useActionState, useState } from "react";
import { saveWorkOrderAction, type WorkOrderFormState } from "@/server/actions/work-orders";
import { VISIT_TYPES } from "@/server/services/work-orders";
import { SignaturePad } from "./signature-pad";

export type WoEquipmentOption = { id: string; label: string };
export type WoMaterialDraft = { description: string; quantity: number; unitCost: number };

const VISIT_LABELS: Record<string, string> = {
  instalacion: "Instalación",
  mantenimiento: "Mantenimiento",
  reparacion: "Reparación",
  limpieza: "Limpieza",
  otro: "Otro",
};

const MEASUREMENT_FIELDS: { key: string; label: string }[] = [
  { key: "presion_baja", label: "Presión baja" },
  { key: "presion_alta", label: "Presión alta" },
  { key: "temp_retorno", label: "Temp. retorno" },
  { key: "temp_impulsion", label: "Temp. impulsión" },
  { key: "amperaje", label: "Amperaje" },
  { key: "tension", label: "Tensión" },
  { key: "superheat", label: "Superheat" },
  { key: "subcooling", label: "Subcooling" },
];

export function WorkOrderForm({
  equipment,
  initialEquipmentId,
}: {
  equipment: WoEquipmentOption[];
  initialEquipmentId?: string;
}) {
  const [state, action, pending] = useActionState(
    saveWorkOrderAction,
    {} as WorkOrderFormState,
  );
  const [materials, setMaterials] = useState<WoMaterialDraft[]>([
    { description: "", quantity: 1, unitCost: 0 },
  ]);
  const [measurements, setMeasurements] = useState<Record<string, string>>({});

  function setMeasurement(key: string, value: string) {
    setMeasurements((prev) => ({ ...prev, [key]: value }));
  }

  const measurementsJson = JSON.stringify(
    Object.fromEntries(
      MEASUREMENT_FIELDS.map((f) => {
        const v = measurements[f.key]?.trim();
        return [f.key, v ? Number(v) : null];
      }),
    ),
  );

  function updateMaterial(i: number, patch: Partial<WoMaterialDraft>) {
    setMaterials((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="measurements" value={measurementsJson} />
      <input type="hidden" name="materials" value={JSON.stringify(materials)} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Equipo</span>
          <select name="equipmentId" required defaultValue={initialEquipmentId} className="input">
            {equipment.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Tipo de visita</span>
          <select name="visitType" className="input" defaultValue="mantenimiento">
            {VISIT_TYPES.map((t) => (
              <option key={t} value={t}>
                {VISIT_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Diagnóstico</span>
        <textarea name="diagnosisNotes" rows={2} className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Falla encontrada</span>
        <input name="faultFound" className="input" />
      </label>

      <div className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
        <p className="text-sm font-medium text-zinc-500">
          Mediciones (opcional — solo si corresponde)
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MEASUREMENT_FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-xs">
              <span>{f.label}</span>
              <input
                type="number"
                step="0.01"
                value={measurements[f.key] ?? ""}
                onChange={(e) => setMeasurement(f.key, e.target.value)}
                className="input"
              />
            </label>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm sm:w-40">
        <span className="font-medium">Garantía (días)</span>
        <input type="number" min={0} name="warrantyDays" className="input" />
      </label>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="font-medium">Materiales usados (con costo)</p>
          <button
            type="button"
            onClick={() =>
              setMaterials((p) => [...p, { description: "", quantity: 1, unitCost: 0 }])
            }
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
          >
            + Agregar
          </button>
        </div>
        {materials.map((m, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <input
              placeholder="Descripción"
              value={m.description}
              onChange={(e) => updateMaterial(i, { description: e.target.value })}
              className="input sm:col-span-2"
            />
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="Cantidad"
              value={m.quantity}
              onChange={(e) => updateMaterial(i, { quantity: Number(e.target.value) })}
              className="input"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Costo unit."
                value={m.unitCost}
                onChange={(e) => updateMaterial(i, { unitCost: Number(e.target.value) })}
                className="input"
              />
              <button
                type="button"
                onClick={() => setMaterials((p) => p.filter((_, idx) => idx !== i))}
                className="text-sm text-red-600"
              >
                Quitar
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <p className="font-medium">Firma del cliente</p>
        <SignaturePad name="signatureImage" />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Guardar orden de trabajo"}
      </button>
    </form>
  );
}
