"use client";

import { useActionState, useState } from "react";
import { MODULES, type ModuleKey } from "@/lib/modules";
import { createPlanAction, updatePlanAction, type PlanActionState } from "@/server/actions/plans";

type Props = {
  initialData?: {
    id?: string;
    key: string;
    name: string;
    description: string;
    price_monthly: number;
    price_yearly: number;
    features: string[];
    is_active: boolean;
    sort_order: number;
  };
};

export function PlanForm({ initialData }: Props) {
  const isEditing = !!initialData?.id;
  const [state, action, pending] = useActionState(
    isEditing ? updatePlanAction : createPlanAction,
    {} as PlanActionState,
  );
  const [modules, setModules] = useState<Set<string>>(
    () => new Set(initialData?.features ?? []),
  );

  const [formData, setFormData] = useState({
    key: initialData?.key ?? "",
    name: initialData?.name ?? "",
    description: initialData?.description ?? "",
    price_monthly: initialData?.price_monthly ?? 0,
    price_yearly: initialData?.price_yearly ?? 0,
    is_active: initialData?.is_active ?? true,
    sort_order: initialData?.sort_order ?? 0,
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  }

  function handleModuleChange(key: string) {
    setModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <form action={action} className="mb-6 flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <input type="hidden" name="id" value={initialData?.id ?? ""} />
      <h2 className="text-lg font-semibold">{isEditing ? "Editar plan" : "Nuevo plan"}</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Key (único, sin espacios)">
          <input name="key" required value={formData.key} onChange={handleChange} className="input" />
        </Field>
        <Field label="Nombre">
          <input name="name" required value={formData.name} onChange={handleChange} className="input" />
        </Field>
        <Field label="Precio mensual (ARS)">
          <input name="price_monthly" type="number" min="0" step="100" value={formData.price_monthly} onChange={handleChange} className="input" />
        </Field>
        <Field label="Precio anual (ARS)">
          <input name="price_yearly" type="number" min="0" step="100" value={formData.price_yearly} onChange={handleChange} className="input" />
        </Field>
        <Field label="Orden">
          <input name="sort_order" type="number" min="0" value={formData.sort_order} onChange={handleChange} className="input" />
        </Field>
        <Field label="Activo">
          <select name="is_active" value={String(formData.is_active)} onChange={handleChange} className="input">
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
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
                onChange={() => {
                  setModules((prev) => {
                    const next = new Set(prev);
                    if (next.has(m.key)) next.delete(m.key);
                    else next.add(m.key);
                    return next;
                  });
                }}
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

      <div>
        <p className="mb-2 text-sm font-medium">Descripción</p>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-600">{isEditing ? "Plan actualizado." : "Plan creado."}</p>}

      <input type="hidden" name="id" value={initialData?.id ?? ""} />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Guardando…" : isEditing ? "Guardar cambios" : "Crear plan"}
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