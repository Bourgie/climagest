"use client";

import { deleteEquipmentAction } from "@/server/actions/equipment";

export function DeleteEquipmentButton({ equipmentId }: { equipmentId: string }) {
  return (
    <form action={deleteEquipmentAction}>
      <input type="hidden" name="equipmentId" value={equipmentId} />
      <button
        type="submit"
        className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600 dark:border-red-800"
      >
        Eliminar equipo
      </button>
    </form>
  );
}
