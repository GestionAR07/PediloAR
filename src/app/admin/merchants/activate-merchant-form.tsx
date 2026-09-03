"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { activateMerchantAction } from "../actions";
import { initialActionState } from "../action-state";

type ActivateMerchantFormProps = {
  merchantId: string;
  status: string;
  ready: boolean;
};

export function ActivateMerchantForm({
  merchantId,
  status,
  ready,
}: ActivateMerchantFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    activateMerchantAction.bind(null, merchantId),
    initialActionState,
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  if (status === "ACTIVE") {
    return (
      <p className="text-sm text-accent" role="status">
        Comercio activo y habilitado para aparecer públicamente.
      </p>
    );
  }

  if (status !== "DRAFT") {
    return (
      <p className="text-sm text-muted">
        Este estado no se modifica desde el onboarding. La reactivación de un
        comercio suspendido se gestiona por separado.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
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
        disabled={pending || !ready}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Activando…" : "Activar comercio"}
      </button>
      {!ready ? (
        <p className="text-xs text-muted">
          Completá los requisitos pendientes antes de activar.
        </p>
      ) : null}
    </form>
  );
}
