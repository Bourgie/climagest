"use client";

import { useActionState, useRef } from "react";
import { login } from "@/server/actions/auth";

const initialState = {} as { error?: string };

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Handler estable usando useRef - la función no se recrea en cada render
  const submitHandler = (e: React.FormEvent) => {
    // Honeypot check - if filled, it's likely a bot
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const honeypot = formData.get("website") as string;
    if (honeypot && honeypot.length > 0) {
      e.preventDefault();
      // Silently fail for bots (don't reveal protection)
      return;
    }

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
      {/* Honeypot field - hidden from humans, visible to bots */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="absolute left-[-9999px] top-[-9999px] opacity-0 pointer-events-none aria-hidden"
        aria-hidden="true"
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="companyCode" className="text-sm font-medium">
          Código de empresa
        </label>
        <input
          id="companyCode"
          name="companyCode"
          type="text"
          autoCapitalize="characters"
          autoComplete="off"
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-base dark.border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="username" className="text-sm font-medium">
          Usuario
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-base dark.border-zinc-700 dark:bg-zinc-700"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
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
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}