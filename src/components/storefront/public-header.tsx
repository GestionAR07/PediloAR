"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type {
  PublicNavContext,
  PublicZoneOption,
} from "@/application/storefront/types";
import { useCart } from "@/components/cart/cart-provider";
import { PublicBrandWordmark } from "@/components/storefront/public-brand-wordmark";
import { persistAndNavigateToZone } from "@/components/storefront/zone-picker";
import {
  ChevronDownIcon,
  CloseIcon,
  MapPinIcon,
  ShoppingBagIcon,
} from "@/components/ui/public-icons";

type Props = {
  nav: PublicNavContext;
  zoneLabel?: string | null;
  zones?: PublicZoneOption[];
  selectedZoneId?: string | null;
};

export function PublicHeader({
  nav,
  zoneLabel,
  zones,
  selectedZoneId = null,
}: Props) {
  const { badgeCount, hydrated } = useCart();
  const router = useRouter();
  const titleId = useId();
  const [zoneOpen, setZoneOpen] = useState(false);
  const canChooseZone = Boolean(zones && zones.length > 0);

  useEffect(() => {
    if (!zoneOpen) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setZoneOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoneOpen]);

  function chooseZone(zoneId: string): void {
    persistAndNavigateToZone(router, zoneId);
    setZoneOpen(false);
  }

  return (
    <header className="public-storefront nav-blur sticky top-0 z-40 border-b border-violet-100/60 transition-shadow">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:h-20 lg:px-8">
        <Link
          href="/"
          className="min-w-0 shrink-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]"
        >
          <PublicBrandWordmark size="header" tone="plain" />
        </Link>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {canChooseZone ? (
            <button
              type="button"
              onClick={() => setZoneOpen(true)}
              className="flex max-w-[42vw] items-center gap-2 rounded-full border border-violet-100 bg-violet-50 py-2 pr-2 pl-2.5 text-left transition hover:bg-violet-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)] sm:max-w-none sm:pr-3"
              aria-haspopup="dialog"
              aria-expanded={zoneOpen}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white">
                <MapPinIcon className="h-4 w-4" />
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Entregar en
                </span>
                <span className="block max-w-[110px] truncate text-xs font-bold text-[var(--ps-night-900)]">
                  {zoneLabel ?? "Elegí tu zona"}
                </span>
              </span>
              <ChevronDownIcon className="hidden h-4 w-4 text-slate-400 sm:block" />
              <span className="sm:hidden">
                <span className="sr-only">
                  {zoneLabel ? `Zona: ${zoneLabel}` : "Elegí tu zona"}
                </span>
              </span>
            </button>
          ) : zoneLabel ? (
            <p className="hidden max-w-[140px] truncate text-xs text-muted sm:block">
              Zona: {zoneLabel}
            </p>
          ) : null}

          <Link
            href="/carrito"
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ps-night-900)] text-white shadow-lg transition hover:bg-[#221647] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]"
          >
            <ShoppingBagIcon className="h-5 w-5" />
            <span className="sr-only">Carrito</span>
            {hydrated && badgeCount > 0 ? (
              <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-500 px-1 text-[11px] font-extrabold text-white">
                {badgeCount}
              </span>
            ) : null}
          </Link>

          {nav.merchantHomeHref ? (
            <Link
              href={nav.merchantHomeHref}
              className="hidden rounded-full px-3 py-2 text-sm font-bold text-slate-600 transition hover:text-fuchsia-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)] lg:inline"
            >
              Mi comercio
            </Link>
          ) : null}
          {nav.isAdmin ? (
            <Link
              href="/admin"
              className="hidden rounded-full px-3 py-2 text-sm font-bold text-slate-600 transition hover:text-fuchsia-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)] lg:inline"
            >
              Admin
            </Link>
          ) : null}
          <Link
            href="/login"
            className={`hidden whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)] lg:inline ${
              nav.isAuthenticated
                ? "text-slate-600 transition hover:text-fuchsia-600"
                : "text-white shadow-glow grad-btn"
            }`}
          >
            {nav.isAuthenticated ? "Acceso comercios" : "Ingresar"}
          </Link>
          <Link
            href="/login"
            aria-label={nav.isAuthenticated ? "Acceso comercios" : "Ingresar"}
            className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-sm font-bold text-violet-700 lg:hidden"
          >
            {nav.isAuthenticated ? "Acceso" : "Ingresar"}
          </Link>
        </div>
      </div>

      {zoneOpen && canChooseZone && zones ? (
        <div className="fixed inset-0 z-50" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--ps-night)]/60 backdrop-blur-sm"
            aria-label="Cerrar selector de zona"
            onClick={() => setZoneOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-[2rem] bg-white p-6 shadow-2xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[2rem] sm:p-7"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
            <div className="mb-6 flex items-start justify-between gap-3">
              <h2
                id={titleId}
                className="font-display text-xl font-extrabold text-[var(--ps-night-900)]"
              >
                ¿Dónde querés comprar?
              </h2>
              <button
                type="button"
                onClick={() => setZoneOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]"
              >
                <CloseIcon className="h-5 w-5" />
                <span className="sr-only">Cerrar</span>
              </button>
            </div>
            <div className="space-y-2">
              {zones.map((zone) => {
                const selected = zone.id === selectedZoneId;
                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => chooseZone(zone.id)}
                    aria-pressed={selected}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)] ${
                      selected
                        ? "border-violet-200 bg-violet-50"
                        : "border-transparent hover:border-violet-100 hover:bg-violet-50"
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                      <MapPinIcon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-extrabold text-[var(--ps-night-900)]">
                        {zone.name}
                      </span>
                      <span className="text-xs font-medium text-muted">
                        {zone.cityName}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
