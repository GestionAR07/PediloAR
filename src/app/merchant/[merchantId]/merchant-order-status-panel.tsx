"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import type { MerchantOperationalStatus } from "@/domain/merchant/operational-availability";
import type { MerchantOperationalPresentation } from "@/lib/merchant-operational-presentation";
import type { MerchantOperationalActionState } from "./actions";

type PauseDuration = 15 | 30 | 60;

type Props = {
  merchantId: string;
  operationalStatus: MerchantOperationalStatus;
  presentation: MerchantOperationalPresentation;
  pauseTemporaryAction: (
    merchantId: string,
    durationMinutes: PauseDuration,
  ) => Promise<MerchantOperationalActionState>;
  pauseManualAction: (
    merchantId: string,
  ) => Promise<MerchantOperationalActionState>;
  resumeAction: (merchantId: string) => Promise<MerchantOperationalActionState>;
};

const PAUSE_OPTIONS: Array<{ value: PauseDuration; label: string }> = [
  { value: 15, label: "15 minutos" },
  { value: 30, label: "30 minutos" },
  { value: 60, label: "1 hora" },
];

export function MerchantOrderStatusPanel({
  merchantId,
  operationalStatus,
  presentation,
  pauseTemporaryAction,
  pauseManualAction,
  resumeAction,
}: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fieldsetId = useId();
  const [selectedDuration, setSelectedDuration] = useState<PauseDuration>(30);
  const [manualSelected, setManualSelected] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const accepting = operationalStatus === "ACCEPTING";
  const paused =
    operationalStatus === "TEMPORARILY_PAUSED" ||
    operationalStatus === "MANUALLY_PAUSED";

  function openPauseDialog() {
    setSelectedDuration(30);
    setManualSelected(false);
    setError(null);
    dialogRef.current?.showModal();
  }

  function closePauseDialog() {
    dialogRef.current?.close();
  }

  function runAction(action: () => Promise<MerchantOperationalActionState>) {
    startTransition(async () => {
      setError(null);
      setFeedback(null);
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      closePauseDialog();
      setFeedback(result.success);
      router.refresh();
    });
  }

  return (
    <section className="merchant-ops-status space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">Estado de pedidos</h2>
        <p className="flex items-center gap-2 text-sm">
          <span
            aria-hidden
            className={`merchant-ops-status-dot ${
              accepting
                ? "merchant-ops-status-dot--live"
                : "merchant-ops-status-dot--paused"
            }`}
          />
          <span className="font-medium">{presentation.headline}</span>
        </p>
        <p className="text-sm text-muted">{presentation.description}</p>
      </header>

      {feedback && (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-[var(--ps-navy,#083F66)]">
          {feedback}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      )}

      {presentation.canManagePause && accepting && (
        <button
          type="button"
          disabled={pending}
          onClick={openPauseDialog}
          className="pedilo-action-warning min-h-11 rounded-xl px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
        >
          Pausar pedidos
        </button>
      )}

      {presentation.canManagePause && paused && (
        <button
          type="button"
          disabled={pending}
          onClick={() => runAction(() => resumeAction(merchantId))}
          className="pedilo-action-success min-h-11 rounded-xl px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
        >
          {operationalStatus === "TEMPORARILY_PAUSED"
            ? "Reactivar ahora"
            : "Reactivar pedidos"}
        </button>
      )}

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[min(calc(100%-2rem),28rem)] overflow-y-auto rounded-2xl border border-[#D4E8F3] bg-white p-0 shadow-lg backdrop:bg-black/40"
      >
        <form
          method="dialog"
          className="flex flex-col gap-4 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (manualSelected) {
              runAction(() => pauseManualAction(merchantId));
              return;
            }
            runAction(() => pauseTemporaryAction(merchantId, selectedDuration));
          }}
        >
          <header className="space-y-1">
            <h3 className="text-lg font-semibold">¿Por cuánto tiempo?</h3>
            <p className="text-sm text-muted">
              Elegí una pausa temporal o hasta que lo reactives.
            </p>
          </header>

          <fieldset id={fieldsetId} className="space-y-2">
            <legend className="sr-only">Duración de la pausa</legend>
            {PAUSE_OPTIONS.map((option) => (
              <label
                key={option.value}
                htmlFor={`pause-${option.value}`}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                  !manualSelected && selectedDuration === option.value
                    ? "border-[#20AEE5] bg-sky-50"
                    : "border-[#D4E8F3]"
                }`}
              >
                <input
                  id={`pause-${option.value}`}
                  type="radio"
                  name="pauseDuration"
                  checked={!manualSelected && selectedDuration === option.value}
                  onChange={() => {
                    setManualSelected(false);
                    setSelectedDuration(option.value);
                  }}
                  className="h-4 w-4 accent-accent"
                />
                <span>{option.label}</span>
              </label>
            ))}

            <label
              htmlFor="pause-manual"
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                manualSelected
                  ? "border-[#20AEE5] bg-sky-50"
                  : "border-[#D4E8F3]"
              }`}
            >
              <input
                id="pause-manual"
                type="radio"
                name="pauseDuration"
                checked={manualSelected}
                onChange={() => setManualSelected(true)}
                className="h-4 w-4 accent-accent"
              />
              <span>Hasta que lo reactive</span>
            </label>
          </fieldset>

          {error && <p className="text-sm text-red-900">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="pedilo-action-primary min-h-11 flex-1 rounded-xl px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
            >
              {pending ? "..." : "Confirmar pausa"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={closePauseDialog}
              className="pedilo-action-secondary min-h-11 rounded-md px-4 py-2 text-sm disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
