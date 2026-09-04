"use client";

import { useActionState } from "react";
import { setPasswordAction, type SetPasswordState } from "./actions";

const initial: SetPasswordState = { error: null };

type SetPasswordFormProps = {
  recoveryMode?: boolean;
};

export function SetPasswordForm({
  recoveryMode = false,
}: SetPasswordFormProps) {
  const [state, formAction, pending] = useActionState(
    setPasswordAction,
    initial,
  );

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      {recoveryMode ? (
        <input type="hidden" name="flow" value="recovery" />
      ) : null}
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Nueva contraseña</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={pending}
          className="min-h-12 rounded-2xl border border-sky-100 bg-white px-4 text-foreground outline-none ring-[var(--ps-cyan)] focus:ring-2 disabled:opacity-60"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Repetir contraseña</span>
        <input
          type="password"
          name="confirm"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={pending}
          className="min-h-12 rounded-2xl border border-sky-100 bg-white px-4 text-foreground outline-none ring-[var(--ps-cyan)] focus:ring-2 disabled:opacity-60"
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
        className="min-h-12 w-full rounded-full border border-[#FFC51B] bg-[#FFC51B] px-5 text-sm font-extrabold text-[#083F66] shadow-[0_10px_24px_rgba(8,63,102,0.14)] transition hover:-translate-y-0.5 hover:bg-[#F4BB13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20AEE5] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {pending ? "Guardando…" : "Establecer contraseña"}
      </button>
    </form>
  );
}
