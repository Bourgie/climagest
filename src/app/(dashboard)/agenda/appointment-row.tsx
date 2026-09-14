"use client";

import { updateAppointmentStatusAction, deleteAppointmentAction } from "@/server/actions/appointments";

const STATUS_LABELS: Record<string, string> = {
  programado: "Programado",
  confirmado: "Confirmado",
  en_curso: "En curso",
  completado: "Completado",
  cancelado: "Cancelado",
};

export type AppointmentRowData = {
  id: string;
  scheduled_at: string;
  status: string;
  client_name: string;
  technicians: string[];
};

export function AppointmentRow({
  appointment,
  canUpdate,
  canDelete,
}: {
  appointment: AppointmentRowData;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const date = new Date(appointment.scheduled_at);
  const dateLabel = date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <div className="flex flex-col gap-1">
        <p className="font-medium">{appointment.client_name}</p>
        <p className="text-sm text-zinc-500">{dateLabel}</p>
        <p className="text-sm text-zinc-500">
          {STATUS_LABELS[appointment.status] ?? appointment.status}
          {appointment.technicians.length > 0 &&
            ` · ${appointment.technicians.join(", ")}`}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {canUpdate && appointment.status === "programado" && (
          <form action={updateAppointmentStatusAction}>
            <input type="hidden" name="appointmentId" value={appointment.id} />
            <input type="hidden" name="status" value="confirmado" />
            <button className="rounded-md border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700">
              Confirmar
            </button>
          </form>
        )}
        {canUpdate && (appointment.status === "programado" || appointment.status === "confirmado") && (
          <form action={updateAppointmentStatusAction}>
            <input type="hidden" name="appointmentId" value={appointment.id} />
            <input type="hidden" name="status" value="cancelado" />
            <button className="rounded-md border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700">
              Cancelar
            </button>
          </form>
        )}
        {canDelete && (
          <form action={deleteAppointmentAction}>
            <input type="hidden" name="appointmentId" value={appointment.id} />
            <button className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600 dark:border-red-800">
              Eliminar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
