"use client";

import { useActionState, useState } from "react";
import { saveAppointmentAction, type AppointmentFormState } from "@/server/actions/appointments";

export type ApptClientOption = { id: string; name: string };
export type ApptEquipmentOption = { id: string; label: string };
export type ApptTechnicianOption = { id: string; name: string };

export type AppointmentFormInitial = {
  id: string;
  clientId: string;
  equipmentId: string | null;
  scheduledAt: string;
  estimatedDuration: string;
  notes: string;
  technicianIds: string[];
};

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AppointmentForm({
  mode,
  clients,
  equipment,
  technicians,
  initial,
}: {
  mode: "create" | "edit";
  clients: ApptClientOption[];
  equipment: ApptEquipmentOption[];
  technicians: ApptTechnicianOption[];
  initial?: AppointmentFormInitial;
}) {
  const [state, action, pending] = useActionState(
    saveAppointmentAction,
    {} as AppointmentFormState,
  );
  const [scheduledLocal, setScheduledLocal] = useState(
    initial ? toLocalInput(initial.scheduledAt) : "",
  );
  const [techIds, setTechIds] = useState<Set<string>>(
    () => new Set(initial?.technicianIds ?? []),
  );

  const scheduledIso = scheduledLocal ? new Date(scheduledLocal).toISOString() : "";

  function toggleTech(id: string) {
    setTechIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {mode === "edit" && initial && (
        <input type="hidden" name="appointmentId" value={initial.id} />
      )}
      <input type="hidden" name="scheduledAt" value={scheduledIso} />
      <input type="hidden" name="technicianIds" value={JSON.stringify([...techIds])} />

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
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Fecha y hora</span>
          <input
            type="datetime-local"
            value={scheduledLocal}
            onChange={(e) => setScheduledLocal(e.target.value)}
            required
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Duración estimada (min)</span>
          <input
            type="number"
            min={0}
            name="estimatedDuration"
            defaultValue={initial?.estimatedDuration}
            className="input"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-medium">Técnicos asignados</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {technicians.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={techIds.has(t.id)}
                onChange={() => toggleTech(t.id)}
              />
              {t.name}
            </label>
          ))}
        </div>
        {technicians.length === 0 && (
          <p className="text-sm text-zinc-500">No hay técnicos dados de alta.</p>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Notas</span>
        <textarea name="notes" rows={2} defaultValue={initial?.notes} className="input" />
      </label>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Guardar turno"}
      </button>
    </form>
  );
}
