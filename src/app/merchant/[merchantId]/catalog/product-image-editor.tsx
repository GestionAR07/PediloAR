"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { gateProductImageBeforeUpload } from "@/lib/product-image-client-gate";
import {
  PRODUCT_IMAGE_ACCEPT_ATTR,
  PRODUCT_IMAGE_HELP_TEXT,
} from "@/lib/product-image";
import type { CatalogActionState } from "./action-state";

type Props = {
  merchantId: string;
  productId: string;
  imageUrl: string | null;
  upsertAction: (
    merchantId: string,
    productId: string,
    formData: FormData,
  ) => Promise<CatalogActionState>;
  deleteAction: (
    merchantId: string,
    productId: string,
  ) => Promise<CatalogActionState>;
};

const UNEXPECTED_ACTION_ERROR =
  "No se pudo completar la operación. Intentá de nuevo.";

export function ProductImageEditor({
  merchantId,
  productId,
  imageUrl,
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
    action: () => Promise<CatalogActionState>,
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
        // Transport/network failures must not become a Next.js runtime overlay.
        setError(UNEXPECTED_ACTION_ERROR);
        if (clearFile) {
          clearFileInput();
        }
      }
    });
  }

  function onImageSelected(file: File): void {
    // Client UX gate — does not replace server-side validation.
    const gate = gateProductImageBeforeUpload(file);
    if (!gate.proceed) {
      setSuccess(null);
      setError(gate.error);
      clearFileInput();
      return;
    }

    const formData = new FormData();
    formData.set("image", file);
    run(() => upsertAction(merchantId, productId, formData), true);
  }

  return (
    <section className="merchant-workspace-card merchant-workspace-image-card space-y-4">
      <header className="space-y-1">
        <h2 className="merchant-workspace-card-title">Imagen</h2>
        <p className="merchant-workspace-card-copy">
          {PRODUCT_IMAGE_HELP_TEXT}
        </p>
      </header>

      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt="Imagen del producto"
          className="h-40 w-40 rounded-xl border border-[#D4E8F3] object-cover"
        />
      ) : (
        <div className="flex h-40 w-40 items-center justify-center rounded-xl border border-dashed border-[#D4E8F3] bg-[#F6F8FA] text-center text-xs text-[#4A6B82]">
          No cargaste una imagen todavía.
        </div>
      )}

      {success && (
        <p
          className="merchant-workspace-alert merchant-workspace-alert--success"
          role="status"
        >
          {success}
        </p>
      )}
      {error && (
        <p
          className="merchant-workspace-alert merchant-workspace-alert--error"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <label className="merchant-workspace-secondary-btn merchant-workspace-file-btn">
          {imageUrl ? "Reemplazar imagen" : "Subir imagen"}
          <input
            ref={fileInputRef}
            type="file"
            name="image"
            accept={PRODUCT_IMAGE_ACCEPT_ATTR}
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

        {imageUrl && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => deleteAction(merchantId, productId))}
            className="merchant-workspace-danger-btn"
          >
            {pending ? "..." : "Eliminar imagen"}
          </button>
        )}
      </div>
    </section>
  );
}
