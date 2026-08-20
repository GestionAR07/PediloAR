"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PublicZoneOption } from "@/application/storefront/types";
import { MapPinIcon } from "@/components/ui/public-icons";
import { readPublicZoneId, writePublicZoneId } from "@/lib/public-zone-storage";

type Props = {
  zones: PublicZoneOption[];
  selectedZoneId: string | null;
  selectedZone?: PublicZoneOption | null;
};

export function persistAndNavigateToZone(
  router: { push: (href: string) => void },
  zoneId: string,
): void {
  writePublicZoneId(window.localStorage, zoneId);
  router.push(`/?zone=${encodeURIComponent(zoneId)}`);
}

export function ZonePicker({
  zones,
  selectedZoneId,
  selectedZone = null,
}: Props) {
  const router = useRouter();
  const [changingZone, setChangingZone] = useState(false);
  const activeZone =
    selectedZone ?? zones.find((zone) => zone.id === selectedZoneId) ?? null;
  const compact = Boolean(activeZone);

  useEffect(() => {
    if (selectedZoneId) {
      writePublicZoneId(window.localStorage, selectedZoneId);
      return;
    }

    try {
      const stored = readPublicZoneId(window.localStorage);
      if (stored && zones.some((zone) => zone.id === stored)) {
        router.replace(`/?zone=${encodeURIComponent(stored)}`);
      }
    } catch {
      // ignore storage failures
    }
  }, [router, selectedZoneId, zones]);

  useEffect(() => {
    function syncFromHash(): void {
      if (window.location.hash === "#zona" && activeZone) {
        setChangingZone(true);
      }
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [activeZone]);

  function selectZone(zoneId: string): void {
    persistAndNavigateToZone(router, zoneId);
    setChangingZone(false);
  }

  const showChooser = !compact || changingZone;

  return (
    <section id="zona" className="min-w-0 scroll-mt-24 space-y-4">
      {compact && activeZone ? (
        <div className="flex w-full min-w-0 flex-col gap-3 rounded-[1.5rem] border border-violet-100/70 bg-white/90 px-4 py-3 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0 max-w-full">
            <p className="font-display text-lg font-extrabold tracking-tight break-words text-[var(--ps-night-900)]">
              Comercios en {activeZone.name}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Disponibilidad y logística las define cada comercio.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setChangingZone((open) => !open)}
            aria-expanded={changingZone}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-4 text-sm font-extrabold text-violet-700 transition hover:bg-violet-50 hover:text-fuchsia-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]"
          >
            Cambiar zona
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="mb-2 text-xs font-extrabold tracking-[0.2em] text-fuchsia-600">
            TU ZONA
          </p>
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-[var(--ps-night-900)] lg:text-4xl">
            ¿Dónde querés comprar?
          </h2>
          <p className="text-sm text-muted">
            Elegí tu zona para ver comercios disponibles.
          </p>
        </div>
      )}

      {showChooser ? (
        <div className="space-y-3">
          {compact ? (
            <p className="text-sm font-extrabold text-[var(--ps-night-900)]">
              ¿Dónde querés comprar?
            </p>
          ) : null}
          {zones.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white/80 px-4 py-4 text-sm text-muted">
              Todavía no hay zonas configuradas para el piloto.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {zones.map((zone) => {
                const selected = zone.id === selectedZoneId;
                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => selectZone(zone.id)}
                    aria-pressed={selected}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border p-3 text-left text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)] ${
                      selected
                        ? "border-violet-200 bg-violet-50 text-foreground shadow-soft"
                        : "border-transparent bg-white text-foreground shadow-soft hover:border-violet-100 hover:bg-violet-50"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        selected
                          ? "bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white"
                          : "bg-violet-100 text-violet-700"
                      }`}
                    >
                      <MapPinIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-extrabold">
                        {zone.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs font-normal text-muted">
                        {zone.cityName}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
