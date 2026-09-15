"use client";

import { useActionState, useState } from "react";
import { MODULES, MODULE_PRESETS, type ModuleKey, type Plan } from "@/lib/modules";
import { updateCompanyAction, type SuperadminActionState } from "@/server/actions/superadmin";

type Props = {
  initialData: {
    name: string;
    companyCode: string;
    status: string;
    plan: Plan;
    modules: Set<string>;
  };
};

export function UpdateCompanyForm({ initialData }: Props) {
  const [plan, setPlan] = useState<Plan>(initialData.plan);
  const [modules, setModules] = useState<Set<string>>(() => new Set(initialData.modules));
  const [state, action, pending] = useActionState(updateCompanyAction, {});

  function changePlan(next: Plan) {
    setPlan(next);
    setModules(new Set<string>(MODULE_PRESETS[next]));
  }

  function toggle(key: ModuleKey) {
    setModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <h2 className="text-lg font-semibold">Editar empresa</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nombre">
          <input name="name" required defaultValue={initialData.name} className="input" />
        </Field>
        <Field label="Código (mayúsculas)">
          <input name="companyCode" required defaultValue={initialData.companyCode} className="input" />
        </Field>
        <Field label="Estado">
          <select name="status" className="input" defaultValue={initialData.status}>
            <option value="trial">Prueba</option>
            <option value="active">Activa</option>
            <option value="suspended">Suspendida</option>
            <option value="blocked">Bloqueada</option>
          </select>
        </Field>
        <Field label="Plan">
          <select
            name="plan"
            className="input"
            value={plan}
            onChange={(e) => changePlan(e.target.value as Plan)}
          >
            {["basico", "profesional", "premium"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </Field>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Módulos</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {MODULES.map((m) => (
            <label key={m.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={modules.has(m.key)}
                onChange={() => toggle(m.key)}
              />
              {m.label}
            </label>
          ))}
        </div>
        {MODULES.map((m) => (
          <input
            key={`h_${m.key}`}
            type="hidden"
            name={`module_${m.key}`}
            value={modules.has(m.key) ? "on" : "off"}
          />
        ))}
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-600">Empresa actualizada.</p>}

      <input type="hidden" name="companyId" value="" />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}