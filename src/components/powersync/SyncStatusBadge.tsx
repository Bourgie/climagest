"use client";

import { useStatus } from "@powersync/react";

/**
 * Indicador permanente de estado de sincronización (UX obligatoria,
 * skill offline-powersync): el técnico siempre sabe si lo cargado ya subió.
 * 🟢 Sincronizado / 🔴 Sin conexión / 🔄 Sincronizando.
 */
export function SyncStatusBadge() {
  const status = useStatus();

  if (status.downloadError || status.uploadError) {
    return (
      <span
        role="status"
        className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800"
      >
        🔴 Error de sincronización
      </span>
    );
  }

  if (!status.connected) {
    return (
      <span
        role="status"
        className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800"
      >
        🔴 Sin conexión
      </span>
    );
  }

  if (status.downloading || status.uploading) {
    return (
      <span
        role="status"
        className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800"
      >
        🔄 Sincronizando…
      </span>
    );
  }

  return (
    <span
      role="status"
      className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800"
    >
      🟢 Sincronizado
      {status.lastSyncedAt
        ? ` · ${status.lastSyncedAt.toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
          })}`
        : ""}
    </span>
  );
}
