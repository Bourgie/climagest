"use client";

import { useActionState } from "react";
import {
  requestServiceFromQrAction,
  type QrRequestState,
} from "@/server/actions/service-requests";

export function InquiryForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(
    requestServiceFromQrAction,
    {} as QrRequestState,
  );

  if (state?.success) {
    return (
      <p className="text-center text-green-600">
        Solicitud enviada. Te contactaremos a la brevedad.
      </p>
    );
  }

  return (
    <form action={action} className="flex w-full flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <input
        name="name"
        placeholder="Tu nombre"
        required
        className="rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
      />
      <input
        name="contact"
        placeholder="Teléfono o email de contacto"
        required
        className="rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
      />
      <textarea
        name="message"
        placeholder="¿En qué podemos ayudarte?"
        rows={3}
        className="rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-3 text-base font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Enviando…" : "Solicitar servicio"}
      </button>
    </form>
  );
}
