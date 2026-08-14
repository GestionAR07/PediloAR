"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import {
  acceptMerchantOrderAction,
  rejectMerchantOrderAction,
} from "@/app/merchant/[merchantId]/orders/actions";

const REJECT_OPTIONS: Array<{
  value: "MERCHANT_UNAVAILABLE" | "OUT_OF_STOCK" | "OTHER";
  label: string;
}> = [
  { value: "MERCHANT_UNAVAILABLE", label: "Comercio no disponible" },
  { value: "OUT_OF_STOCK", label: "Sin stock" },
  { value: "OTHER", label: "Otro motivo" },
];

type Props = {
  merchantId: string;
  orderId: string;
};

export function MerchantPendingOrderActions({ merchantId, orderId }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("");
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  function closeDialog() {
    dialogRef.current?.close();
    setReason("");
  }

  function runAccept() {
    startTransition(async () => {
      setError(null);
      setAccepting(true);
      const result = await acceptMerchantOrderAction(merchantId, orderId);
      setAccepting(false);
      if (!result.ok) {
        setError(result.message ?? "No se pudo aceptar el pedido.");
        return;
      }
      router.refresh();
    });
  }

  function runReject() {
    if (!reason) {
      setError("Elegí un motivo para rechazar el pedido.");
      return;
    }
    startTransition(async () => {
      setError(null);
      setRejecting(true);
      const result = await rejectMerchantOrderAction(
        merchantId,
        orderId,
        reason,
      );
      setRejecting(false);
      if (!result.ok) {
        setError(result.message ?? "No se pudo rechazar el pedido.");
        return;
      }
      closeDialog();
      router.refresh();
    });
  }

  const busy = pending;

  return (
    <div className="space-y-2" aria-busy={busy}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={busy}
          onClick={runAccept}
          className="min-h-11 flex-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
        >
          {accepting ? "Aceptando..." : "Aceptar"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setError(null);
            setReason("");
            dialogRef.current?.showModal();
          }}
          className="min-h-11 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-60"
        >
          Rechazar
        </button>
      </div>
      {error ? (
        <p className="text-sm text-red-900" role="alert">
          {error}
        </p>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="w-[min(100%,28rem)] rounded-lg border border-border bg-white p-0 shadow-lg backdrop:bg-black/40"
      >
        <form
          className="flex flex-col gap-4 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            runReject();
          }}
        >
          <header className="space-y-1">
            <h2 id={titleId} className="text-lg font-semibold">
              Rechazar pedido
            </h2>
            <p className="text-sm text-muted">
              Elegí el motivo. Esta acción no se puede deshacer.
            </p>
          </header>

          <fieldset className="space-y-2">
            <legend className="sr-only">Motivo de rechazo</legend>
            {REJECT_OPTIONS.map((option) => (
              <label
                key={option.value}
                htmlFor={`reject-${orderId}-${option.value}`}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                  reason === option.value
                    ? "border-accent bg-accent/5"
                    : "border-border"
                }`}
              >
                <input
                  id={`reject-${orderId}-${option.value}`}
                  type="radio"
                  name={`reject-reason-${orderId}`}
                  value={option.value}
                  checked={reason === option.value}
                  onChange={() => setReason(option.value)}
                  className="h-4 w-4 accent-accent"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={busy || !reason}
              className="min-h-11 flex-1 rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-900 disabled:opacity-60"
            >
              {rejecting ? "Rechazando..." : "Confirmar rechazo"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={closeDialog}
              className="min-h-11 rounded-md border border-border px-4 py-2 text-sm"
            >
              Volver
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
