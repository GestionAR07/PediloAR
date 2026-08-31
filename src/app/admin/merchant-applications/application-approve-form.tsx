"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { approveMerchantApplicationAction } from "./actions";
import type { ApproveMerchantApplicationActionState } from "../action-state";

type ApplicationApproveFormProps = {
  applicationId: string;
  defaultSlug: string;
};

const initial: ApproveMerchantApplicationActionState = {
  error: null,
  success: null,
};

export function ApplicationApproveForm({
  applicationId,
  defaultSlug,
}: ApplicationApproveFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    approveMerchantApplicationAction,
    initial,
  );

  useEffect(() => {
    if (state.merchantId) {
      router.push(`/admin/merchants/${state.merchantId}`);
      router.refresh();
    }
  }, [state.merchantId, router]);

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <input type="hidden" name="applicationId" value={applicationId} />

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Slug</span>
        <input
          name="slug"
          required
          defaultValue={defaultSlug}
          placeholder="mi-comercio"
          className="rounded-md border border-border bg-background px-3 py-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="pickupEnabled" defaultChecked />
        <span>Retiro habilitado</span>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="merchantDeliveryEnabled" />
        <span>Delivery propio habilitado</span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">
          Tiempo estimado de preparación (minutos)
        </span>
        <input
          type="number"
          name="preparationMinutes"
          min={0}
          max={1440}
          defaultValue={30}
          required
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
        {pending ? "Aprobando…" : "Aprobar solicitud"}
      </button>
    </form>
  );
}
