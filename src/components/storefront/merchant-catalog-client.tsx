"use client";

import { useMemo, useState } from "react";
import type {
  PublicCategoryView,
  PublicProductCard,
} from "@/application/storefront/types";
import { ProductOptionsSheet } from "./product-options-sheet";

type Props = {
  categories: PublicCategoryView[];
  products: PublicProductCard[];
};

export function MerchantCatalogClient({ categories, products }: Props) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const [selected, setSelected] = useState<PublicProductCard | null>(null);

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

  return (
    <div className="space-y-4">
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
                  {product.hasOptions ? (
                    <button
                      type="button"
                      onClick={() => setSelected(product)}
                      className="mt-1 min-h-10 rounded-md border border-border px-3 text-xs font-medium"
                    >
                      Ver opciones
                    </button>
                  ) : product.description ? (
                    <button
                      type="button"
                      onClick={() => setSelected(product)}
                      className="mt-1 min-h-10 rounded-md border border-border px-3 text-xs font-medium"
                    >
                      Ver detalle
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ProductOptionsSheet
        product={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
