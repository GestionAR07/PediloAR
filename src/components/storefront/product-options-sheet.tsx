"use client";

import { useEffect, useId, useRef } from "react";
import type { PublicProductCard } from "@/application/storefront/types";

type Props = {
  product: PublicProductCard | null;
  open: boolean;
  onClose: () => void;
};

export function ProductOptionsSheet({ product, open, onClose }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !product) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-[var(--color-bg)] p-5 shadow-lg sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              {product.name}
            </h2>
            <p className="mt-1 text-sm text-muted">{product.priceLabel}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-md border border-border px-3 text-sm"
          >
            Cerrar
          </button>
        </div>

        {!product.sellable && product.statusLabel ? (
          <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {product.statusLabel}
          </p>
        ) : null}

        {product.description ? (
          <p className="mb-4 text-sm text-muted">{product.description}</p>
        ) : null}

        <div className="space-y-4">
          {product.optionGroups.map((group) => (
            <section key={group.id} className="space-y-2">
              <div>
                <h3 className="text-sm font-semibold">{group.name}</h3>
                <p className="text-xs text-muted">
                  {group.modeLabel}. {group.hint}
                </p>
              </div>
              <ul className="space-y-1.5">
                {group.choices.map((choice) => (
                  <li
                    key={choice.id}
                    className="flex items-center justify-between rounded-md border border-border bg-white/70 px-3 py-2 text-sm"
                  >
                    <span>{choice.name}</span>
                    {choice.priceDeltaLabel ? (
                      <span className="text-muted">
                        +{choice.priceDeltaLabel}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
