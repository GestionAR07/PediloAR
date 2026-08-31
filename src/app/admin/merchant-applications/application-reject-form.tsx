"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { rejectMerchantApplicationAction } from "./actions";
import { initialActionState } from "../action-state";

type ApplicationRejectFormProps = {
  applicationId: string;
};

export function ApplicationRejectForm({
  applicationId,
}: ApplicationRejectFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    rejectMerchantApplicationAction,
    initialActionState,
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <input type="hidden" name="applicationId" value={applicationId} />

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Motivo de rechazo</span>
        <textarea
          name="rejectionReason"
          required
          rows={4}
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
        className="rounded-md border border-border px-3 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "Rechazando…" : "Rechazar solicitud"}
      </button>
    </form>
  );
}
