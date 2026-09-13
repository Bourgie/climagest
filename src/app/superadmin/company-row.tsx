"use client";

import { useActionState } from "react";
import { MODULES } from "@/lib/modules";
import {
  resetOwnerPasswordAction,
  updateCompanyModulesAction,
  updateCompanyStatusAction,
  type SuperadminActionState,
} from "@/server/actions/superadmin";

export type CompanyRowData = {
  id: string;
  name: string;
  company_code: string;
  status: string;
  plan: string;
  modules: string[];
};

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  suspended: "Suspendida",
  blocked: "Bloqueada",
  trial: "Prueba",
};

export function CompanyRow({ company }: { company: CompanyRowData }) {
  const [statusState, statusAction, statusPending] = useActionState(
    updateCompanyStatusAction,
    {} as SuperadminActionState,
  );
  const [modulesState, modulesAction, modulesPending] = useActionState(
    updateCompanyModulesAction,
    {} as SuperadminActionState,
  );
  const [resetState, resetAction, resetPending] = useActionState(
    resetOwnerPasswordAction,
    {} as SuperadminActionState,
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">
            {company.name}{" "}
            <span className="font-mono text-sm text-zinc-500">{company.company_code}</span>
          </p>
          <p className="text-sm text-zinc-500">
            {STATUS_LABELS[company.status] ?? company.status} · plan {company.plan}
          </p>
        </div>
        <form action={statusAction} className="flex items-center gap-2">
          <input type="hidden" name="companyId" value={company.id} />
          <select name="status" defaultValue={company.status} className="input !w-auto">
            <option value="active">Activa</option>
            <option value="suspended">Suspendida</option>
            <option value="blocked">Bloqueada</option>
            <option value="trial">Prueba</option>
          </select>
          <button
            type="submit"
            disabled={statusPending}
            className="rounded-md bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            Guardar
          </button>
        </form>
      </div>
      {statusState?.error && <p className="text-sm text-red-600">{statusState.error}</p>}

      <form action={modulesAction} className="flex flex-col gap-2">
        <input type="hidden" name="companyId" value={company.id} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MODULES.map((m) => (
            <label key={m.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={`module_${m.key}`}
                defaultChecked={company.modules.includes(m.key)}
              />
              {m.label}
            </label>
          ))}
        </div>
        <button
          type="submit"
          disabled={modulesPending}
          className="self-start rounded-md bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          Guardar módulos
        </button>
      </form>
      {modulesState?.error && <p className="text-sm text-red-600">{modulesState.error}</p>}

      <form action={resetAction} className="flex items-center gap-2">
        <input type="hidden" name="companyId" value={company.id} />
        <input
          name="password"
          type="password"
          placeholder="Nueva contraseña del Dueño"
          minLength={8}
          required
          className="input flex-1"
        />
        <button
          type="submit"
          disabled={resetPending}
          className="rounded-md bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          Resetear
        </button>
      </form>
      {resetState?.error && <p className="text-sm text-red-600">{resetState.error}</p>}
      {resetState?.success && resetState.provisionalPassword && (
        <p className="text-sm text-green-600">
          Contraseña provisoria: <strong>{resetState.provisionalPassword}</strong>
        </p>
      )}
    </div>
  );
}
