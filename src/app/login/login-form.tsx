"use client";

import { useActionState } from "react";
import { GoogleOAuthSection } from "@/components/auth/google-oauth-section";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

type LoginFormProps = {
  nextPath?: string;
  googleOAuthEnabled: boolean;
};

export function LoginForm({ nextPath, googleOAuthEnabled }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <div className="space-y-5">
      {googleOAuthEnabled ? <GoogleOAuthSection nextPath={nextPath} /> : null}
      <form action={formAction} className="flex w-full flex-col gap-4">
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            className="min-h-12 rounded-2xl border border-violet-100 bg-white px-4 text-foreground outline-none ring-violet-500 focus:ring-2"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">Contraseña</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            className="min-h-12 rounded-2xl border border-violet-100 bg-white px-4 text-foreground outline-none ring-violet-500 focus:ring-2"
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
          className="grad-btn min-h-12 rounded-full px-5 text-sm font-extrabold text-white shadow-glow transition disabled:opacity-60"
        >
          {pending ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
