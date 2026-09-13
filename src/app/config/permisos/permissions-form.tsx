"use client";

import { useActionState } from "react";
import { savePermissions, type PermissionsActionState } from "@/server/actions/permissions";

export type PermissionItem = { key: string; label: string; category: string };

const CATEGORY_LABELS: Record<string, string> = {
  clientes: "Clientes",
  pagos: "Pagos",
  costos: "Costos",
  presupuestos: "Presupuestos",
  usuarios: "Usuarios",
  configuracion: "Configuración",
};

export function PermissionsForm({
  role,
  permissions,
  initialAllowed,
}: {
  role: "admin" | "technician";
  permissions: PermissionItem[];
  initialAllowed: Set<string>;
}) {
  const [state, action, pending] = useActionState(
    savePermissions,
    {} as PermissionsActionState,
  );

  const byCategory = new Map<string, PermissionItem[]>();
  for (const p of permissions) {
    const list = byCategory.get(p.category) ?? [];
    list.push(p);
    byCategory.set(p.category, list);
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
    >
      <input type="hidden" name="role" value={role} />
      {Array.from(byCategory.entries()).map(([category, items]) => (
        <div key={category}>
          <p className="mb-2 text-sm font-semibold uppercase text-zinc-500">
            {CATEGORY_LABELS[category] ?? category}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {items.map((p) => (
              <label key={p.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={`perm_${p.key}`}
                  defaultChecked={initialAllowed.has(p.key)}
                />
                {p.label}
              </label>
            ))}
          </div>
        </div>
      ))}

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-600">Guardado.</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
