"use client";

import { updateServiceRequestStatusAction } from "@/server/actions/service-requests";

const STATUS_LABELS: Record<string, string> = {
  recibido: "Recibido",
  presupuestado: "Presupuestado",
  agendado: "Agendado",
  en_curso: "En curso",
  resuelto: "Resuelto",
  cancelado: "Cancelado",
};

const ORIGIN_LABELS: Record<string, string> = {
  llamada: "Llamada",
  whatsapp: "WhatsApp",
  qr_publico: "QR público",
  presencial: "Presencial",
};

export type ServiceRequestRow = {
  id: string;
  origin: string;
  status: string;
  description: string | null;
  created_at: string;
  client_name: string;
};

export function ServiceRequestRow({
  request,
  canUpdate,
}: {
  request: ServiceRequestRow;
  canUpdate: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <div className="flex flex-col gap-1">
        <p className="font-medium">{request.client_name}</p>
        <p className="text-sm text-zinc-500">
          {ORIGIN_LABELS[request.origin] ?? request.origin} ·{" "}
          {STATUS_LABELS[request.status] ?? request.status}
        </p>
        {request.description && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{request.description}</p>
        )}
      </div>
      {canUpdate && request.status === "recibido" && (
        <form action={updateServiceRequestStatusAction}>
          <input type="hidden" name="requestId" value={request.id} />
          <input type="hidden" name="status" value="cancelado" />
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
          >
            Cancelar
          </button>
        </form>
      )}
    </div>
  );
}
