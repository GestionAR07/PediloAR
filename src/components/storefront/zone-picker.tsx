"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { PublicZoneOption } from "@/application/storefront/types";

const STORAGE_KEY = "mr.public.zoneId";

type Props = {
  zones: PublicZoneOption[];
  selectedZoneId: string | null;
};

export function ZonePicker({ zones, selectedZoneId }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (selectedZoneId) {
      try {
        window.localStorage.setItem(STORAGE_KEY, selectedZoneId);
      } catch {
        // ignore storage failures
      }
      return;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && zones.some((zone) => zone.id === stored)) {
        router.replace(`/?zone=${encodeURIComponent(stored)}`);
      }
    } catch {
      // ignore storage failures
    }
  }, [router, selectedZoneId, zones]);

  function selectZone(zoneId: string): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, zoneId);
    } catch {
      // ignore
    }
    router.push(`/?zone=${encodeURIComponent(zoneId)}`);
  }

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">
          ¿Dónde querés comprar?
        </h2>
        <p className="text-sm text-muted">
          Elegí tu zona para ver comercios disponibles.
        </p>
      </div>

      {zones.length === 0 ? (
        <p className="rounded-md border border-border bg-white/60 px-3 py-3 text-sm text-muted">
          Todavía no hay zonas configuradas para el piloto.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {zones.map((zone) => {
            const selected = zone.id === selectedZoneId;
            return (
              <button
                key={zone.id}
                type="button"
                onClick={() => selectZone(zone.id)}
                className={`min-h-12 rounded-lg border px-4 py-3 text-left text-sm font-medium transition ${
                  selected
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-border bg-white/70 text-foreground hover:border-accent/50"
                }`}
              >
                <span className="block">{zone.name}</span>
                <span className="mt-0.5 block text-xs font-normal text-muted">
                  {zone.cityName}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
