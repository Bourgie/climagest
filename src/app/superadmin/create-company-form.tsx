"use client";

import { useActionState, useState } from "react";
import { MODULES, MODULE_PRESETS, PLANS, type ModuleKey, type Plan } from "@/lib/modules";
import { createCompanyAction, type SuperadminActionState } from "@/server/actions/superadmin";

const initialState: SuperadminActionState = {};

export function CreateCompanyForm() {
  const [plan, setPlan] = useState<Plan>("profesional");
  const [modules, setModules] = useState<Set<string>>(
    () => new Set<string>(MODULE_PRESETS.profesional),
  );
  const [state, action, pending] = useActionState(createCompanyAction, initialState);

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
      <h2 className="text-lg font-semibold">Alta de empresa</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nombre">
          <input name="name" required className="input" />
        </Field>
        <Field label="Código (mayúsculas)">
          <input name="companyCode" required className="input" />
        </Field>
        <Field label="Estado">
          <select name="status" className="input" defaultValue="trial">
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
            {PLANS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Dueño — nombre">
          <input name="ownerFullName" required className="input" />
        </Field>
        <Field label="Dueño — usuario">
          <input name="ownerUsername" required className="input" />
        </Field>
        <Field label="Dueño — contraseña provisoria">
          <input name="ownerPassword" required minLength={8} className="input" />
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
      {state?.success && state.provisionalPassword && (
        <p className="text-sm text-green-600">
          Empresa creada. Contraseña provisoria del Dueño:{" "}
          <strong>{state.provisionalPassword}</strong>
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Creando…" : "Crear empresa"}
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
