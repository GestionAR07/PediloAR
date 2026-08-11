"use client";

import { useActionState } from "react";
import { inviteOwnerAction, initialActionState } from "../actions";

type InviteOwnerFormProps = {
  merchantId: string;
};

export function InviteOwnerForm({ merchantId }: InviteOwnerFormProps) {
  const [state, formAction, pending] = useActionState(
    inviteOwnerAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-3">
      <input type="hidden" name="merchantId" value={merchantId} />
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Email del propietario</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded-md border border-border bg-background px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Nombre para mostrar (opcional)</span>
        <input
          name="displayName"
          className="rounded-md border border-border bg-background px-3 py-2"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-accent" role="status">
          {state.success}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Invitando…" : "Invitar propietario"}
      </button>
    </form>
  );
}
