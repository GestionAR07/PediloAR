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
import { SearchIcon } from "@/components/ui/public-icons";
import { ProductOptionsSheet } from "./product-options-sheet";

type Props = {
  merchantId: string;
  merchantName: string;
  categories: PublicCategoryView[];
  products: PublicProductCard[];
};

const chipBase =
  "min-h-11 snap-start shrink-0 rounded-full border-2 px-5 py-2.5 text-sm font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]";
const chipActive = `${chipBase} chip-active border-transparent`;
const chipIdle = `${chipBase} border-slate-200 bg-white text-slate-600 hover:border-fuchsia-300`;

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

  const showStickyCart = hydrated && badgeCount > 0;
  const stickyCartLabel =
    badgeCount === 1
      ? `Ver carrito · 1 producto`
      : `Ver carrito · ${badgeCount} productos`;

  return (
    <div className="min-w-0 space-y-5">
      <div
        className={
          showStickyCart
            ? "min-w-0 space-y-5 max-sm:pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]"
            : "min-w-0 space-y-5"
        }
      >
        {feedback ? (
          <p
            role="status"
            className="rounded-2xl bg-violet-50 px-4 py-3 text-sm font-medium text-violet-800"
          >
            {feedback}
          </p>
        ) : null}

        <div className="min-w-0 space-y-2">
          <label className="block text-sm font-bold" htmlFor="product-search">
            Buscar en este comercio
          </label>
          <div className="relative min-w-0">
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-violet-500">
              <SearchIcon className="h-4 w-4" />
            </span>
            <input
              id="product-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar productos…"
              className="min-h-12 w-full min-w-0 max-w-full rounded-full border-2 border-violet-100 bg-white py-2.5 pr-4 pl-11 text-sm font-medium shadow-soft transition focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-100 focus-visible:outline-none"
            />
          </div>
        </div>

        {categories.length > 0 ? (
          <div className="no-scrollbar flex min-w-0 gap-2 overflow-x-auto pb-1 snap-x snap-mandatory">
            <button
              type="button"
              onClick={() => setCategoryId("all")}
              aria-pressed={categoryId === "all"}
              className={categoryId === "all" ? chipActive : chipIdle}
            >
              Todas
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
                aria-pressed={categoryId === category.id}
                className={categoryId === category.id ? chipActive : chipIdle}
              >
                {category.name}
              </button>
            ))}
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <div className="rounded-[2rem] border-2 border-dashed border-violet-200 bg-white px-6 py-14 text-center">
            <p className="font-display text-lg font-extrabold text-[var(--ps-night-900)]">
              {query.trim()
                ? "No hay productos que coincidan con tu búsqueda."
                : "Este comercio todavía no tiene productos disponibles."}
            </p>
            {!query.trim() ? (
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                Cuando el comercio publique su catálogo, va a aparecer acá.
              </p>
            ) : null}
          </div>
        ) : (
          <ul className="merchant-product-grid grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
            {filtered.map((product) => (
              <li key={product.id} className="min-w-0">
                <article
                  className={`merchant-product-card group flex h-full min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-violet-100/70 bg-white shadow-soft ${
                    product.sellable ? "card-lift" : "opacity-90"
                  }`}
                >
                  <div className="merchant-product-media relative isolate shrink-0 overflow-hidden bg-gradient-to-br from-violet-200 to-fuchsia-200">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt=""
                        loading="lazy"
                        className="zoom-img h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        aria-hidden
                        className="relative h-full w-full overflow-hidden"
                      >
                        <div className="zoom-img absolute inset-0 bg-gradient-to-br from-violet-800 via-violet-600 to-fuchsia-500" />
                        <span className="font-display absolute inset-0 flex items-center justify-center text-3xl font-extrabold text-white/90 sm:text-4xl">
                          {product.name.slice(0, 1).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-4 sm:p-5">
                    {product.categoryName ? (
                      <p className="text-[11px] font-bold tracking-wider break-words text-slate-400 uppercase">
                        {product.categoryName}
                      </p>
                    ) : null}
                    <h3 className="font-display text-base font-extrabold leading-snug tracking-tight break-words text-[var(--ps-night-900)] sm:text-lg">
                      {product.name}
                    </h3>
                    {product.description ? (
                      <p className="line-clamp-2 text-sm break-words text-slate-500">
                        {product.description}
                      </p>
                    ) : null}
                    <p className="grad-text mt-auto pt-3 text-base font-extrabold">
                      {product.priceLabel}
                    </p>
                    {product.statusLabel ? (
                      <p className="text-xs font-bold text-amber-900">
                        {product.statusLabel}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {product.hasOptions ? (
                        <button
                          type="button"
                          onClick={() => setSelected(product)}
                          className="inline-flex min-h-11 items-center rounded-full border border-violet-200 bg-violet-50 px-5 text-sm font-extrabold text-violet-800 transition hover:border-fuchsia-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]"
                        >
                          {product.canAddToCart
                            ? "Elegir opciones"
                            : "Ver detalle"}
                        </button>
                      ) : product.canAddToCart ? (
                        <button
                          type="button"
                          onClick={() => handleAdd(product, [])}
                          className="grad-btn inline-flex min-h-11 items-center rounded-full px-5 text-sm font-extrabold text-white shadow-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]"
                        >
                          Agregar
                        </button>
                      ) : product.description ? (
                        <button
                          type="button"
                          onClick={() => setSelected(product)}
                          className="inline-flex min-h-11 items-center rounded-full border border-violet-200 bg-white px-5 text-sm font-extrabold text-violet-800 transition hover:border-fuchsia-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]"
                        >
                          Ver detalle
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
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
              className="absolute inset-0 bg-[var(--ps-night)]/60 backdrop-blur-sm"
              onClick={() => setConflict(null)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="merchant-conflict-title"
              className="relative z-10 w-full max-w-md space-y-4 rounded-t-[2rem] border border-violet-100 bg-white p-6 shadow-2xl sm:rounded-[2rem]"
            >
              <h2
                id="merchant-conflict-title"
                className="font-display text-xl font-extrabold tracking-tight text-[var(--ps-night-900)]"
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
                  className="min-h-11 rounded-full border border-violet-100 px-4 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]"
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
                  className="grad-btn min-h-11 rounded-full px-4 text-sm font-extrabold text-white shadow-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]"
                >
                  Vaciar carrito y continuar
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {showStickyCart ? (
        <div className="pb-safe sticky bottom-3 z-20 sm:hidden">
          <Link
            href="/carrito"
            className="grad-btn flex min-h-12 items-center justify-between gap-3 rounded-full px-5 text-sm font-extrabold whitespace-nowrap text-white shadow-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]"
          >
            <span className="min-w-0 truncate">{stickyCartLabel}</span>
            <span className="shrink-0">
              {formatMoneyCentsArs(moneyCents(totalCents))}
            </span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
