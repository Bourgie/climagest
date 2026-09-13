"use client";

import { useActionState, useState } from "react";
import { saveClientAction, type ClientFormState } from "@/server/actions/clients";

export type ClientFormAddress = {
  label?: string;
  address: string;
  isPrimary: boolean;
};
export type ClientFormContact = {
  name: string;
  roleLabel?: string;
  phone?: string;
  email?: string;
};
export type ClientFormInitial = {
  id: string;
  name: string;
  notes: string;
  addresses: ClientFormAddress[];
  contacts: ClientFormContact[];
};

export function ClientForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: ClientFormInitial;
}) {
  const [state, action, pending] = useActionState(
    saveClientAction,
    {} as ClientFormState,
  );
  const [addresses, setAddresses] = useState<ClientFormAddress[]>(
    initial?.addresses ?? [{ label: "", address: "", isPrimary: true }],
  );
  const [contacts, setContacts] = useState<ClientFormContact[]>(
    initial?.contacts ?? [],
  );

  function updateAddress(i: number, patch: Partial<ClientFormAddress>) {
    setAddresses((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }
  function setPrimary(i: number) {
    setAddresses((prev) => prev.map((a, idx) => ({ ...a, isPrimary: idx === i })));
  }
  function updateContact(i: number, patch: Partial<ClientFormContact>) {
    setContacts((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {mode === "edit" && initial && (
        <input type="hidden" name="clientId" value={initial.id} />
      )}
      <input type="hidden" name="addresses" value={JSON.stringify(addresses)} />
      <input type="hidden" name="contacts" value={JSON.stringify(contacts)} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Nombre</span>
          <input name="name" required defaultValue={initial?.name} className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Notas</span>
          <input name="notes" defaultValue={initial?.notes} className="input" />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="font-medium">Direcciones</p>
          <button
            type="button"
            onClick={() => setAddresses((p) => [...p, { label: "", address: "", isPrimary: false }])}
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
          >
            + Agregar
          </button>
        </div>
        {addresses.map((a, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <input
                placeholder="Etiqueta (casa, local…)"
                value={a.label ?? ""}
                onChange={(e) => updateAddress(i, { label: e.target.value })}
                className="input"
              />
              <input
                placeholder="Dirección"
                value={a.address}
                onChange={(e) => updateAddress(i, { address: e.target.value })}
                className="input sm:col-span-2"
              />
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={a.isPrimary}
                    onChange={() => setPrimary(i)}
                  />
                  Primaria
                </label>
                <button
                  type="button"
                  onClick={() => setAddresses((p) => p.filter((_, idx) => idx !== i))}
                  className="text-sm text-red-600"
                >
                  Quitar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="font-medium">Contactos</p>
          <button
            type="button"
            onClick={() => setContacts((p) => [...p, { name: "", roleLabel: "", phone: "", email: "" }])}
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
          >
            + Agregar
          </button>
        </div>
        {contacts.map((c, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-700 sm:grid-cols-4">
            <input
              placeholder="Nombre"
              value={c.name}
              onChange={(e) => updateContact(i, { name: e.target.value })}
              className="input"
            />
            <input
              placeholder="Rol (titular, encargado…)"
              value={c.roleLabel ?? ""}
              onChange={(e) => updateContact(i, { roleLabel: e.target.value })}
              className="input"
            />
            <input
              placeholder="Teléfono"
              value={c.phone ?? ""}
              onChange={(e) => updateContact(i, { phone: e.target.value })}
              className="input"
            />
            <div className="flex items-center gap-2">
              <input
                placeholder="Email"
                value={c.email ?? ""}
                onChange={(e) => updateContact(i, { email: e.target.value })}
                className="input"
              />
              <button
                type="button"
                onClick={() => setContacts((p) => p.filter((_, idx) => idx !== i))}
                className="text-sm text-red-600"
              >
                Quitar
              </button>
            </div>
          </div>
        ))}
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
