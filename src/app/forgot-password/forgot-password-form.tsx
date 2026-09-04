"use client";

import { useActionState } from "react";
import {
  requestPasswordResetAction,
  type ForgotPasswordState,
} from "./actions";

const initialState: ForgotPasswordState = { error: null, success: null };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          disabled={pending}
          className="min-h-12 rounded-2xl border border-sky-100 bg-white px-4 text-foreground outline-none ring-[var(--ps-cyan)] focus:ring-2 disabled:opacity-60"
        />
      </label>

      {state.error ? (
        <p className="text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p
          className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-foreground"
          role="status"
        >
          {state.success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-full border border-[#FFC51B] bg-[#FFC51B] px-5 text-sm font-extrabold text-[#083F66] shadow-[0_10px_24px_rgba(8,63,102,0.14)] transition hover:-translate-y-0.5 hover:bg-[#F4BB13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20AEE5] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {pending ? "Enviando…" : "Enviar enlace"}
      </button>
    </form>
  );
}
