"use client";

import { useActionState } from "react";
import { createUser, type UsersActionState } from "@/server/actions/users";

export function CreateUserForm({ canCreate }: { canCreate: boolean }) {
  const [state, action, pending] = useActionState(createUser, {} as UsersActionState);

  if (!canCreate) return null;

  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
    >
      <h2 className="text-lg font-semibold">Nuevo usuario</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Nombre</span>
          <input name="fullName" required className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Usuario</span>
          <input name="username" required className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Rol</span>
          <select name="role" className="input" defaultValue="technician">
            <option value="admin">Administrativo</option>
            <option value="technician">Técnico</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Contraseña provisoria</span>
          <input name="password" required minLength={8} className="input" />
        </label>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && state.provisionalPassword && (
        <p className="text-sm text-green-600">
          Usuario creado. Contraseña provisoria:{" "}
          <strong>{state.provisionalPassword}</strong>
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Creando…" : "Crear usuario"}
      </button>
    </form>
  );
}
