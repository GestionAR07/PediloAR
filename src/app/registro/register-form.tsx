"use client";

import Link from "next/link";
import { useActionState } from "react";
import { GoogleOAuthSection } from "@/components/auth/google-oauth-section";
import { registerCustomerAction, type RegisterState } from "./actions";

const initialState: RegisterState = { error: null, success: null };

export function RegisterForm({
  nextPath,
  googleOAuthEnabled,
}: {
  nextPath?: string;
  googleOAuthEnabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    registerCustomerAction,
    initialState,
  );
  return (
    <div className="space-y-5">
      {googleOAuthEnabled ? <GoogleOAuthSection nextPath={nextPath} /> : null}
      <form action={action} className="space-y-4">
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold">Nombre</span>
          <input
            name="displayName"
            autoComplete="name"
            maxLength={80}
            required
            className="min-h-12 w-full rounded-2xl border border-violet-100 bg-white px-4 outline-none ring-violet-500 focus:ring-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold">Teléfono</span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={32}
            required
            className="min-h-12 w-full rounded-2xl border border-violet-100 bg-white px-4 outline-none ring-violet-500 focus:ring-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="min-h-12 w-full rounded-2xl border border-violet-100 bg-white px-4 outline-none ring-violet-500 focus:ring-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold">Contraseña</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
            className="min-h-12 w-full rounded-2xl border border-violet-100 bg-white px-4 outline-none ring-violet-500 focus:ring-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold">Repetir contraseña</span>
          <input
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
            className="min-h-12 w-full rounded-2xl border border-violet-100 bg-white px-4 outline-none ring-violet-500 focus:ring-2"
          />
        </label>
        {state.error ? (
          <p
            className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p
            className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
            role="status"
          >
            {state.success}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending || Boolean(state.success)}
          className="grad-btn min-h-12 w-full rounded-full px-5 text-sm font-extrabold text-white shadow-glow disabled:opacity-60"
        >
          {pending ? "Creando cuenta…" : "Crear mi cuenta"}
        </button>
        <p className="text-center text-sm text-muted">
          ¿Ya tenés cuenta?{" "}
          <Link
            href={
              nextPath
                ? `/login?next=${encodeURIComponent(nextPath)}`
                : "/login"
            }
            className="font-bold text-violet-800 hover:underline"
          >
            Ingresar
          </Link>
        </p>
      </form>
    </div>
  );
}
