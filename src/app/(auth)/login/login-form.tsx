"use client";

import { useActionState, useRef, useEffect } from "react";
import { login, type LoginState } from "@/server/actions/auth";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    startTimeRef.current = Date.now();
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // Honeypot check - if filled, it's likely a bot
    const formData = new FormData(e.currentTarget);
    const honeypot = formData.get("website") as string;
    if (honeypot && honeypot.length > 0) {
      e.preventDefault();
      // Silently fail for bots (don't reveal protection)
      return;
    }

    // Minimum time check (humans need ~2s to fill form)
    const elapsed = Date.now() - startTimeRef.current;
    if (elapsed < 1500) {
      e.preventDefault();
      // Could show a generic error or just delay
      setTimeout(() => {
        formRef.current?.requestSubmit();
      }, 1500 - elapsed);
      return;
    }
  };

  return (
    <form ref={formRef} action={action} className="flex w-full max-w-sm flex-col gap-4" onSubmit={handleSubmit}>
      {/* Honeypot field - hidden from humans, visible to bots */}
      <input
        type="text"
        name="website"
        id="website"
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
          className="rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
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
          className="rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-700"
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
          className="rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {state?.error && (
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
