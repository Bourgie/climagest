"use client";

import { deleteClientAction } from "@/server/actions/clients";

export function DeleteClientButton({ clientId }: { clientId: string }) {
  return (
    <form action={deleteClientAction}>
      <input type="hidden" name="clientId" value={clientId} />
      <button
        type="submit"
        className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600 dark:border-red-800"
      >
        Eliminar cliente
      </button>
    </form>
  );
}
