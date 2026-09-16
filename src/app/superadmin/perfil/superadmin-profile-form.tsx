"use client";

import { useActionState, useState } from "react";
import { updateSuperadminProfileAction, changeSuperadminPasswordAction, type SuperadminProfileActionState } from "@/server/actions/superadmin";

type Props = {
  userId: string;
};

export function SuperadminProfileForm({ userId }: Props) {
  const [state, action, pending] = useActionState(updateSuperadminProfileAction, {} as SuperadminProfileActionState);
  const [passwordState, passwordAction, passwordPending] = useActionState(changeSuperadminPasswordAction, {} as SuperadminProfileActionState);

  const [formData, setFormData] = useState({
    full_name: "",
    username: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  return (
    <div className="space-y-8">
      <form action={action} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
        <h2 className="text-lg font-semibold mb-4">Datos personales</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nombre completo">
            <input name="full_name" required value={formData.full_name} onChange={handleChange} className="input" />
          </Field>
          <Field label="Usuario">
            <input name="username" required value={formData.username} onChange={handleChange} className="input" />
          </Field>
        </div>

        <input type="hidden" name="userId" value={userId} />
        {state?.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
        {state?.success && <p className="mt-3 text-sm text-green-600">Perfil actualizado.</p>}

        <button type="submit" disabled={pending} className="mt-4 self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>

      <form action={passwordAction} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
        <h2 className="text-lg font-semibold mb-4">Cambiar contraseña</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Contraseña actual">
            <input name="current_password" type="password" required className="input" />
          </Field>
          <Field label="Nueva contraseña">
            <input name="new_password" type="password" required minLength={8} className="input" />
          </Field>
        </div>
        <Field label="Confirmar nueva contraseña">
          <input name="confirm_password" type="password" required minLength={8} className="input" />
        </Field>

        <input type="hidden" name="userId" value={userId} />
        {passwordState?.error && <p className="mt-3 text-sm text-red-600">{passwordState.error}</p>}
        {passwordState?.success && <p className="mt-3 text-sm text-green-600">Contraseña cambiada.</p>}

        <button type="submit" disabled={passwordPending} className="mt-4 self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {passwordPending ? "Cambiando…" : "Cambiar contraseña"}
        </button>
      </form>
    </div>
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