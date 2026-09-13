"use client";

import { useActionState } from "react";
import {
  changeUserRole,
  resetPassword,
  toggleUserActive,
  type UsersActionState,
} from "@/server/actions/users";

export type MemberRow = {
  user_id: string;
  role: "owner" | "admin" | "technician";
  status: string;
  full_name: string;
  username: string;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Dueño",
  admin: "Administrativo",
  technician: "Técnico",
};

export function UserRow({
  member,
  canUpdate,
  canReset,
}: {
  member: MemberRow;
  canUpdate: boolean;
  canReset: boolean;
}) {
  const [roleState, roleAction, rolePending] = useActionState(
    changeUserRole,
    {} as UsersActionState,
  );
  const [toggleState, toggleAction, togglePending] = useActionState(
    toggleUserActive,
    {} as UsersActionState,
  );
  const [resetState, resetAction, resetPending] = useActionState(
    resetPassword,
    {} as UsersActionState,
  );

  const isOwner = member.role === "owner";
  const isActive = member.status === "active";

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">
            {member.full_name}{" "}
            <span className="text-sm text-zinc-500">@{member.username}</span>
          </p>
          <p className="text-sm text-zinc-500">
            {ROLE_LABELS[member.role] ?? member.role}
            {!isActive && " · inactivo"}
          </p>
        </div>

        {!isOwner && canUpdate && (
          <form action={roleAction} className="flex items-center gap-2">
            <input type="hidden" name="userId" value={member.user_id} />
            <select name="role" defaultValue={member.role} className="input !w-auto">
              <option value="admin">Administrativo</option>
              <option value="technician">Técnico</option>
            </select>
            <button
              type="submit"
              disabled={rolePending}
              className="rounded-md bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-50"
            >
              Cambiar rol
            </button>
          </form>
        )}
      </div>
      {roleState?.error && <p className="text-sm text-red-600">{roleState.error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {!isOwner && canUpdate && (
          <form action={toggleAction}>
            <input type="hidden" name="userId" value={member.user_id} />
            <input type="hidden" name="active" value={isActive ? "false" : "true"} />
            <button
              type="submit"
              disabled={togglePending}
              className="rounded-md border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
            >
              {isActive ? "Desactivar" : "Reactivar"}
            </button>
          </form>
        )}

        {!isOwner && canReset && (
          <form action={resetAction} className="flex items-center gap-2">
            <input type="hidden" name="userId" value={member.user_id} />
            <input
              name="password"
              type="password"
              placeholder="Nueva contraseña"
              minLength={8}
              required
              className="input !w-auto"
            />
            <button
              type="submit"
              disabled={resetPending}
              className="rounded-md border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
            >
              Resetear
            </button>
          </form>
        )}
      </div>
      {toggleState?.error && <p className="text-sm text-red-600">{toggleState.error}</p>}
      {resetState?.error && <p className="text-sm text-red-600">{resetState.error}</p>}
      {resetState?.success && resetState.provisionalPassword && (
        <p className="text-sm text-green-600">
          Contraseña provisoria: <strong>{resetState.provisionalPassword}</strong>
        </p>
      )}
    </div>
  );
}
