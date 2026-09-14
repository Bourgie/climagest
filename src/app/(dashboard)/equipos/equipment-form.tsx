"use client";

import { useActionState, useState } from "react";
import { EQUIPMENT_TYPES, EQUIPMENT_TYPE_LABELS, REFRIGERANTS } from "@/lib/equipment-types";
import { saveEquipmentAction, type EquipmentFormState } from "@/server/actions/equipment";

export type EquipmentClientOption = {
  id: string;
  name: string;
  addresses: { id: string; address: string; label: string | null }[];
};

export type EquipmentFormInitial = {
  id: string;
  clientId: string;
  addressId: string | null;
  equipmentType: string;
  brand: string;
  model: string;
  serialNumber: string;
  btu: string;
  power: string;
  refrigerantType: string;
  installDate: string;
  warrantyUntil: string;
  conditionStatus: string;
  locationLabel: string;
};

export function EquipmentForm({
  mode,
  clients,
  initial,
}: {
  mode: "create" | "edit";
  clients: EquipmentClientOption[];
  initial?: EquipmentFormInitial;
}) {
  const [state, action, pending] = useActionState(
    saveEquipmentAction,
    {} as EquipmentFormState,
  );
  const [clientId, setClientId] = useState(initial?.clientId ?? clients[0]?.id ?? "");
  const selectedClient = clients.find((c) => c.id === clientId);

  return (
    <form action={action} className="flex flex-col gap-4">
      {mode === "edit" && initial && (
        <input type="hidden" name="equipmentId" value={initial.id} />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Cliente</span>
          <select
            name="clientId"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
            className="input"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Dirección de instalación</span>
          <select name="addressId" defaultValue={initial?.addressId ?? ""} className="input">
            <option value="">Sin dirección específica</option>
            {(selectedClient?.addresses ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.label ? `${a.label} — ` : ""}
                {a.address}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Tipo de equipo</span>
          <select
            name="equipmentType"
            defaultValue={initial?.equipmentType ?? "split"}
            className="input"
          >
            {EQUIPMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EQUIPMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Refrigerante</span>
          <select
            name="refrigerantType"
            defaultValue={initial?.refrigerantType ?? ""}
            className="input"
          >
            <option value="">—</option>
            {REFRIGERANTS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Marca</span>
          <input name="brand" defaultValue={initial?.brand} className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Modelo</span>
          <input name="model" defaultValue={initial?.model} className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Nº de serie</span>
          <input name="serialNumber" defaultValue={initial?.serialNumber} className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">BTU</span>
          <input
            name="btu"
            type="number"
            defaultValue={initial?.btu}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Potencia</span>
          <input name="power" defaultValue={initial?.power} className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Estado</span>
          <input
            name="conditionStatus"
            defaultValue={initial?.conditionStatus}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Ubicación exacta</span>
          <input
            name="locationLabel"
            defaultValue={initial?.locationLabel}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Fecha de instalación</span>
          <input
            name="installDate"
            type="date"
            defaultValue={initial?.installDate}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Garantía del equipo hasta</span>
          <input
            name="warrantyUntil"
            type="date"
            defaultValue={initial?.warrantyUntil}
            className="input"
          />
        </label>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
