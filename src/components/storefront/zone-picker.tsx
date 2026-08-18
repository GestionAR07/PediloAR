"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { PublicZoneOption } from "@/application/storefront/types";
import { MapPinIcon } from "@/components/ui/public-icons";
import { readPublicZoneId, writePublicZoneId } from "@/lib/public-zone-storage";

type Props = {
  zones: PublicZoneOption[];
  selectedZoneId: string | null;
};

export function persistAndNavigateToZone(
  router: { push: (href: string) => void },
  zoneId: string,
): void {
  writePublicZoneId(window.localStorage, zoneId);
  router.push(`/?zone=${encodeURIComponent(zoneId)}`);
}

export function ZonePicker({ zones, selectedZoneId }: Props) {
  const router = useRouter();

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

  function selectZone(zoneId: string): void {
    persistAndNavigateToZone(router, zoneId);
  }

  return (
    <section id="zona" className="scroll-mt-24 space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-extrabold tracking-[0.2em] text-violet-700">
          TU ZONA
        </p>
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-[var(--ps-night-900)] lg:text-3xl">
          ¿Dónde querés comprar?
        </h2>
        <p className="text-sm text-muted">
          Elegí tu zona para ver comercios disponibles.
        </p>
      </div>

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
                className={`flex min-h-14 items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)] ${
                  selected
                    ? "border-[var(--ps-violet)] bg-violet-50 text-foreground shadow-soft"
                    : "border-transparent bg-white text-foreground shadow-soft hover:border-violet-200"
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
    </section>
  );
}
