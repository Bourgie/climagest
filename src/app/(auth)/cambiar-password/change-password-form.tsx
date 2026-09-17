"use client";

import { useActionState, useRef } from "react";
import { changePassword } from "@/server/actions/auth";

const initialState = {} as { error?: string };

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Handler estable usando useRef - la función no se recrea en cada render
  const submitHandler = (e: React.FormEvent) => {
    // Let the form submit normally (action will be called by Next.js)
    // We do NOT call e.preventDefault() here to allow normal submission
  };

  return (
    <form
      ref={formRef}
      action={action}
      className="flex w-full max-w-sm flex-col gap-4"
      onSubmit={submitHandler}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          Nueva contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="confirm" className="text-sm font-medium">
          Confirmar contraseña
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-base dark.border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-3 text-base font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}