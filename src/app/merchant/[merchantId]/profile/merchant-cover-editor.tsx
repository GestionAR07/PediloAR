"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { MerchantCoverFallback } from "@/components/storefront/merchant-cover-fallback";
import { gateProductImageBeforeUpload } from "@/lib/product-image-client-gate";
import { MERCHANT_COVER_ACCEPT_ATTR } from "@/lib/merchant-cover-image";
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
    <section className="merchant-workspace-card merchant-workspace-cover">
      <h2 className="merchant-workspace-card-title">Imagen de portada</h2>

      <div className="merchant-workspace-cover-layout">
        <div className="merchant-workspace-cover-preview">
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

        <div className="merchant-workspace-cover-side">
          <p className="merchant-workspace-card-copy">
            Se muestra en el listado de comercios y en tu tienda.
          </p>
          <p className="merchant-workspace-card-copy">
            JPG, PNG o WEBP · Máximo 5 MB.
          </p>

          {success ? (
            <p
              className="merchant-workspace-alert merchant-workspace-alert--success"
              role="status"
            >
              {success}
            </p>
          ) : null}
          {error ? (
            <p
              className="merchant-workspace-alert merchant-workspace-alert--error"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="merchant-workspace-cover-actions">
            <label className="merchant-workspace-primary-btn merchant-workspace-file-btn">
              {coverUrl ? "Cambiar portada" : "Subir portada"}
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
                className="merchant-workspace-danger-btn"
              >
                {pending ? "..." : "Eliminar portada"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
