"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  PublicMarketplaceCategory,
  PublicMerchantCard,
  PublicZoneOption,
} from "@/application/storefront/types";
import { MerchantCard } from "@/components/storefront/merchant-card";
import { PublicCategoryRail } from "@/components/storefront/public-category-rail";
import { CloseIcon, SearchIcon, StoreIcon } from "@/components/ui/public-icons";
import { filterPublicMerchants } from "@/lib/filter-public-merchants";

type Props = {
  selectedZone: PublicZoneOption | null;
  merchants: PublicMerchantCard[];
  categories: PublicMarketplaceCategory[];
};

export function PublicDiscoverySection({
  selectedZone,
  merchants,
  categories,
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const effectiveCategoryId =
    selectedCategoryId &&
    categories.some((category) => category.id === selectedCategoryId)
      ? selectedCategoryId
      : null;
  const selectedCategory =
    categories.find((category) => category.id === effectiveCategoryId) ?? null;
  const filtered = useMemo(
    () => filterPublicMerchants(merchants, query, effectiveCategoryId),
    [merchants, query, effectiveCategoryId],
  );
  const trimmedQuery = query.trim();
  const showSearch = Boolean(selectedZone && merchants.length > 0);
  const showCategories = Boolean(selectedZone && categories.length > 0);
  const emptyZone = Boolean(selectedZone && merchants.length === 0);
  const emptyFilter = Boolean(
    selectedZone && merchants.length > 0 && filtered.length === 0,
  );
  const resultKey = filtered.map((merchant) => merchant.id).join(",");

  function clearSearch() {
    setQuery("");
  }

  function clearFilters() {
    setQuery("");
    setSelectedCategoryId(null);
  }

  return (
    <div className="min-w-0 space-y-10 lg:space-y-12">
      {showCategories ? (
        <PublicCategoryRail
          categories={categories}
          selectedCategoryId={effectiveCategoryId}
          onSelect={setSelectedCategoryId}
        />
      ) : null}

      <section id="comercios" className="min-w-0 scroll-mt-24 space-y-6">
        <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-full space-y-1">
            <p className="mb-2 text-xs font-extrabold tracking-[0.2em] break-words text-orange-500">
              COMERCIOS CERCA TUYO
            </p>
            <h2 className="font-display text-2xl font-extrabold tracking-tight break-words text-[var(--ps-night-900)] lg:text-4xl">
              Descubrí qué pedir hoy
            </h2>
            {selectedZone ? (
              <p className="text-sm font-bold text-violet-700">
                En {selectedZone.name}
              </p>
            ) : (
              <p className="text-sm text-muted">
                Elegí tu zona para ver los comercios disponibles.
              </p>
            )}
          </div>

          {showSearch ? (
            <div className="discovery-search relative w-full min-w-0 max-w-full lg:w-[22rem]">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <label className="sr-only" htmlFor="discovery-merchant-search">
                Buscar comercios
              </label>
              <input
                id="discovery-merchant-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar comercios..."
                autoComplete="off"
                className="min-h-11 w-full min-w-0 max-w-full rounded-full border-2 border-violet-100 bg-white py-2.5 pr-12 pl-11 text-sm font-medium text-[var(--ps-night-900)] shadow-soft outline-none transition placeholder:text-slate-400 focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-100"
              />
              {trimmedQuery ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-violet-50 hover:text-violet-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]"
                >
                  <CloseIcon className="h-4 w-4" />
                  <span className="sr-only">Limpiar búsqueda</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {!selectedZone ? null : emptyZone ? (
          <EmptyZoneState zoneName={selectedZone.name} />
        ) : emptyFilter ? (
          <EmptyFilterState
            query={trimmedQuery}
            categoryName={selectedCategory?.name ?? null}
            onClearSearch={clearSearch}
            onClearAll={clearFilters}
          />
        ) : (
          <div
            key={resultKey}
            className="discovery-grid grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filtered.map((merchant) => (
              <MerchantCard
                key={merchant.id}
                merchant={merchant}
                zoneId={selectedZone.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyZoneState({ zoneName }: { zoneName: string }) {
  return (
    <div className="rounded-[2rem] border-2 border-dashed border-violet-200 bg-white px-6 py-16 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-500">
        <StoreIcon className="h-8 w-8" />
      </span>
      <p className="font-display mt-4 text-lg font-extrabold text-[var(--ps-night-900)]">
        Estamos sumando comercios en {zoneName}
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
        Cuando un comercio habilite esta zona, va a aparecer acá.
      </p>
      <Link
        href="/login"
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-extrabold text-fuchsia-600 transition hover:text-fuchsia-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]"
      >
        Sumar mi comercio
      </Link>
    </div>
  );
}

function EmptyFilterState({
  query,
  categoryName,
  onClearSearch,
  onClearAll,
}: {
  query: string;
  categoryName: string | null;
  onClearSearch: () => void;
  onClearAll: () => void;
}) {
  const heading = query
    ? categoryName
      ? `No encontramos comercios con "${query}" en ${categoryName}.`
      : `No encontramos comercios con "${query}"`
    : "No encontramos comercios en esta categoría.";

  return (
    <div className="rounded-[2rem] border-2 border-dashed border-violet-200 bg-white px-6 py-16 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-500">
        <SearchIcon className="h-8 w-8" />
      </span>
      <p className="font-display mt-4 text-lg font-extrabold text-[var(--ps-night-900)]">
        {heading}
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
        {query
          ? "Probá con el nombre o la descripción del comercio."
          : "Probá otra categoría o mirá todos los comercios de la zona."}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {query ? (
          <button
            type="button"
            onClick={onClearSearch}
            className="inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-extrabold text-fuchsia-600 transition hover:text-fuchsia-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]"
          >
            Limpiar búsqueda
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClearAll}
          className="inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-extrabold text-violet-700 transition hover:text-fuchsia-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]"
        >
          Ver todos
        </button>
      </div>
    </div>
  );
}
