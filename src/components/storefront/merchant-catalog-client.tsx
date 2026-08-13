"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  PublicCategoryView,
  PublicProductCard,
} from "@/application/storefront/types";
import type { CartGroupConfiguration } from "@/domain/cart/types";
import { formatMoneyCentsArs } from "@/lib/format-money";
import { moneyCents } from "@/domain/money/money-cents";
import { resolveStockCap } from "@/domain/cart/cart-operations";
import { useCart, type PendingAdd } from "@/components/cart/cart-provider";
import { ProductOptionsSheet } from "./product-options-sheet";

type Props = {
  merchantId: string;
  merchantName: string;
  categories: PublicCategoryView[];
  products: PublicProductCard[];
};

export function MerchantCatalogClient({
  merchantId,
  merchantName,
  categories,
  products,
}: Props) {
  const { tryAdd, confirmReplaceAndAdd, badgeCount, totalCents, hydrated } =
    useCart();
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const [selected, setSelected] = useState<PublicProductCard | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{
    pending: PendingAdd;
    currentMerchantName: string;
  } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryId !== "all" && product.categoryId !== categoryId) {
        return false;
      }
      if (!q) {
        return true;
      }
      return product.name.toLowerCase().includes(q);
    });
  }, [products, query, categoryId]);

  function flash(message: string): void {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 2200);
  }

  function handleAdd(
    product: PublicProductCard,
    configuration: CartGroupConfiguration[],
  ): void {
    if (!product.canAddToCart) {
      return;
    }
    const pending: PendingAdd = {
      merchantId,
      merchantNameSnapshot: merchantName,
      productId: product.id,
      productNameSnapshot: product.name,
      basePriceCents: product.priceCents,
      configuration,
      quantity: 1,
      stockCap: resolveStockCap(product.stockMode, product.stockQuantity),
    };
    const result = tryAdd(pending);
    if (result.status === "merchant_conflict") {
      setConflict({
        pending: result.pending,
        currentMerchantName: result.currentMerchantName,
      });
      return;
    }
    if (result.status === "added") {
      flash(
        result.merged
          ? "Cantidad actualizada en el carrito"
          : "Agregado al carrito",
      );
      setSelected(null);
    }
  }

  return (
    <div className="space-y-4">
      {feedback ? (
        <p
          role="status"
          className="rounded-md bg-accent/10 px-3 py-2 text-sm text-accent"
        >
          {feedback}
        </p>
      ) : null}

      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="product-search">
          Buscar en este comercio
        </label>
        <input
          id="product-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ej: empanadas, gaseosa…"
          className="min-h-11 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
      </div>

      {categories.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCategoryId("all")}
            className={`min-h-10 shrink-0 rounded-full border px-3 text-sm ${
              categoryId === "all"
                ? "border-accent bg-accent/10"
                : "border-border bg-white/70"
            }`}
          >
            Todas
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setCategoryId(category.id)}
              className={`min-h-10 shrink-0 rounded-full border px-3 text-sm ${
                categoryId === category.id
                  ? "border-accent bg-accent/10"
                  : "border-border bg-white/70"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rounded-md border border-border bg-white/60 px-3 py-3 text-sm text-muted">
          {query.trim()
            ? "No hay productos que coincidan con tu búsqueda."
            : "Este comercio todavía no tiene productos visibles."}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((product) => (
            <li
              key={product.id}
              className={`rounded-xl border border-border bg-white/70 p-3 ${
                product.sellable ? "" : "opacity-90"
              }`}
            >
              <div className="flex gap-3">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.imageUrl}
                    alt=""
                    className="h-20 w-20 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(145deg,#efece6,#f7f6f3)] text-xs text-muted"
                  >
                    Sin foto
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold leading-snug">
                      {product.name}
                    </h3>
                    <p className="shrink-0 text-sm font-medium">
                      {product.priceLabel}
                    </p>
                  </div>
                  <p className="text-xs text-muted">{product.categoryName}</p>
                  {product.statusLabel ? (
                    <p className="text-xs font-medium text-amber-900">
                      {product.statusLabel}
                    </p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap gap-2">
                    {product.hasOptions ? (
                      <button
                        type="button"
                        onClick={() => setSelected(product)}
                        className="min-h-10 rounded-md border border-border px-3 text-xs font-medium"
                      >
                        {product.canAddToCart
                          ? "Elegir opciones"
                          : "Ver opciones"}
                      </button>
                    ) : product.canAddToCart ? (
                      <button
                        type="button"
                        onClick={() => handleAdd(product, [])}
                        className="min-h-10 rounded-md bg-accent px-3 text-xs font-medium text-white"
                      >
                        Agregar
                      </button>
                    ) : product.description ? (
                      <button
                        type="button"
                        onClick={() => setSelected(product)}
                        className="min-h-10 rounded-md border border-border px-3 text-xs font-medium"
                      >
                        Ver detalle
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <ProductOptionsSheet
          key={selected.id}
          product={selected}
          open
          onClose={() => setSelected(null)}
          onAddConfigured={(configuration) => {
            handleAdd(selected, configuration);
          }}
          feedback={feedback}
        />
      ) : null}

      {conflict ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/40"
            onClick={() => setConflict(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="merchant-conflict-title"
            className="relative z-10 w-full max-w-md space-y-4 rounded-t-2xl border border-border bg-[var(--color-bg)] p-5 shadow-lg sm:rounded-2xl"
          >
            <h2
              id="merchant-conflict-title"
              className="text-lg font-semibold tracking-tight"
            >
              Cambiar de comercio
            </h2>
            <p className="text-sm text-muted">
              Tu carrito tiene productos de {conflict.currentMerchantName}.
            </p>
            <p className="text-sm text-muted">
              Para comprar en {merchantName}, vaciá el carrito y continuá.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConflict(null)}
                className="min-h-11 rounded-md border border-border px-4 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmReplaceAndAdd(conflict.pending);
                  setConflict(null);
                  setSelected(null);
                  flash("Carrito actualizado");
                }}
                className="min-h-11 rounded-md bg-accent px-4 text-sm font-medium text-white"
              >
                Vaciar carrito y continuar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {hydrated && badgeCount > 0 ? (
        <div className="sticky bottom-3 z-20 sm:hidden">
          <Link
            href="/carrito"
            className="flex min-h-12 items-center justify-between rounded-xl bg-accent px-4 text-sm font-medium text-white shadow-lg"
          >
            <span>Ver carrito · {badgeCount} productos</span>
            <span>{formatMoneyCentsArs(moneyCents(totalCents))}</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
