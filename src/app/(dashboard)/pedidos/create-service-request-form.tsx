"use client";

import { useActionState } from "react";
import {
  createServiceRequestAction,
  type ServiceRequestFormState,
} from "@/server/actions/service-requests";

export type SrClientOption = { id: string; name: string };
export type SrEquipmentOption = { id: string; label: string };

export function CreateServiceRequestForm({
  clients,
  equipment,
}: {
  clients: SrClientOption[];
  equipment: SrEquipmentOption[];
}) {
  const [state, action, pending] = useActionState(
    createServiceRequestAction,
    {} as ServiceRequestFormState,
  );

  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <h2 className="text-lg font-semibold">Nuevo pedido</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Cliente</span>
          <select name="clientId" required className="input">
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Equipo (opcional)</span>
          <select name="equipmentId" className="input" defaultValue="">
            <option value="">Sin equipo específico</option>
            {equipment.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Origen</span>
          <select name="origin" className="input" defaultValue="llamada">
            <option value="llamada">Llamada</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="presencial">Presencial</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Descripción</span>
        <textarea name="description" rows={3} className="input" />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Creando…" : "Crear pedido"}
      </button>
    </form>
  );
}
