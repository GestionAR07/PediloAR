"use client";

import { useActionState } from "react";
import { setPasswordAction, type SetPasswordState } from "./actions";

const initial: SetPasswordState = { error: null };

export function SetPasswordForm() {
  const [state, formAction, pending] = useActionState(
    setPasswordAction,
    initial,
  );

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Nueva contraseña</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="rounded-md border border-border bg-background px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Repetir contraseña</span>
        <input
          type="password"
          name="confirm"
          autoComplete="new-password"
          required
          minLength={8}
          className="rounded-md border border-border bg-background px-3 py-2"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Establecer contraseña"}
      </button>
    </form>
  );
}
