"use client";

import { useActionState } from "react";
import {
  updateCustomerProfileAction,
  type CustomerProfileState,
} from "./actions";

const initialState: CustomerProfileState = { error: null };

export function CustomerProfileForm({
  displayName,
  phone,
  nextPath,
}: {
  displayName: string;
  phone: string;
  nextPath: string;
}) {
  const [state, action, pending] = useActionState(
    updateCustomerProfileAction,
    initialState,
  );
  return (
    <form action={action} className="mt-7 space-y-4">
      <input type="hidden" name="next" value={nextPath} />
      <label className="block text-sm">
        <span className="mb-1.5 block font-bold">Nombre</span>
        <input
          name="displayName"
          autoComplete="name"
          maxLength={80}
          defaultValue={displayName}
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
          defaultValue={phone}
          required
          className="min-h-12 w-full rounded-2xl border border-violet-100 bg-white px-4 outline-none ring-violet-500 focus:ring-2"
        />
        <span className="mt-1.5 block text-xs text-muted">
          Lo usaremos únicamente para coordinar tus pedidos.
        </span>
      </label>
      {state.error ? (
        <p
          className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="grad-btn min-h-12 w-full rounded-full px-5 text-sm font-extrabold text-white shadow-glow disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar mis datos"}
      </button>
    </form>
  );
}
