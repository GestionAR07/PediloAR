"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { MerchantCoverFallback } from "@/components/storefront/merchant-cover-fallback";
import { gateProductImageBeforeUpload } from "@/lib/product-image-client-gate";
import {
  MERCHANT_COVER_ACCEPT_ATTR,
  MERCHANT_COVER_HELP_TEXT,
} from "@/lib/merchant-cover-image";
import type { MerchantCoverActionState } from "./action-state";

type Props = {
  merchantId: string;
  merchantName: string;
  coverUrl: string | null;
  upsertAction: (
    merchantId: string,
    formData: FormData,
  ) => Promise<MerchantCoverActionState>;
  deleteAction: (merchantId: string) => Promise<MerchantCoverActionState>;
};

const UNEXPECTED_ACTION_ERROR =
  "No se pudo completar la operación. Intentá de nuevo.";

export function MerchantCoverEditor({
  merchantId,
  merchantName,
  coverUrl,
  upsertAction,
  deleteAction,
}: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function clearFileInput(): void {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function run(
    action: () => Promise<MerchantCoverActionState>,
    clearFile = false,
  ): void {
    startTransition(async () => {
      setError(null);
      setSuccess(null);
      try {
        const result = await action();
        if (result.error) {
          setError(result.error);
          return;
        }
        setSuccess(result.success);
        if (clearFile) {
          clearFileInput();
        }
        router.refresh();
      } catch {
        setError(UNEXPECTED_ACTION_ERROR);
        if (clearFile) {
          clearFileInput();
        }
      }
    });
  }

  function onImageSelected(file: File): void {
    const gate = gateProductImageBeforeUpload(file);
    if (!gate.proceed) {
      setSuccess(null);
      setError(gate.error);
      clearFileInput();
      return;
    }

    const formData = new FormData();
    formData.set("image", file);
    run(() => upsertAction(merchantId, formData), true);
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-white/50 p-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">Portada del comercio</h2>
        <p className="text-sm text-muted">{MERCHANT_COVER_HELP_TEXT}</p>
      </header>

      <div className="relative h-40 w-full max-w-sm overflow-hidden rounded-md border border-border bg-white">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={`Portada de ${merchantName}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <MerchantCoverFallback name={merchantName} />
        )}
      </div>

      {success ? (
        <p className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
          {success}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-border px-4 py-2 text-sm font-medium">
          {coverUrl ? "Cambiar imagen" : "Subir imagen"}
          <input
            ref={fileInputRef}
            type="file"
            name="image"
            accept={MERCHANT_COVER_ACCEPT_ATTR}
            disabled={pending}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }
              onImageSelected(file);
            }}
          />
        </label>

        {coverUrl ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => deleteAction(merchantId))}
            className="min-h-11 rounded-md border border-amber-700/30 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 disabled:opacity-60"
          >
            {pending ? "..." : "Eliminar imagen"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
