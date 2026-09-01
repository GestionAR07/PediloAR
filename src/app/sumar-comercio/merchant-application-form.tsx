"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { submitMerchantApplicationInitialState } from "./action-state";
import { submitMerchantApplicationAction } from "./actions";

export type CityOption = {
  id: string;
  name: string;
};

export type ZoneOption = {
  id: string;
  cityId: string;
  name: string;
};

type MerchantApplicationFormProps = {
  cities: CityOption[];
  zones: ZoneOption[];
};

export function MerchantApplicationForm({
  cities,
  zones,
}: MerchantApplicationFormProps) {
  const [state, formAction, pending] = useActionState(
    submitMerchantApplicationAction,
    submitMerchantApplicationInitialState,
  );
  const [cityId, setCityId] = useState(cities[0]?.id ?? "");

  const filteredZones = useMemo(
    () => zones.filter((zone) => zone.cityId === cityId),
    [zones, cityId],
  );

  const [zoneId, setZoneId] = useState(filteredZones[0]?.id ?? "");

  const resolvedZoneId = useMemo(() => {
    if (filteredZones.length === 0) {
      return "";
    }
    if (filteredZones.some((zone) => zone.id === zoneId)) {
      return zoneId;
    }
    return filteredZones[0].id;
  }, [filteredZones, zoneId]);

  if (state.success) {
    return (
      <div className="space-y-5">
        <h2 className="font-display text-2xl font-extrabold text-[var(--ps-navy)]">
          Solicitud enviada
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          Recibimos los datos de tu comercio. El equipo de Pedilo va a revisar
          la solicitud antes de habilitar el alta.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          Si necesitamos más información, nos comunicaremos con vos por los
          datos de contacto que ingresaste.
        </p>
        <Link
          href="/"
          className="grad-btn inline-flex min-h-12 items-center rounded-full px-7 py-3 text-sm font-extrabold shadow-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-cyan)]"
        >
          Volver a Pedilo
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1.5 block font-bold">Nombre del comercio</span>
        <input
          name="businessName"
          required
          maxLength={120}
          className="min-h-12 w-full rounded-2xl border border-sky-100 bg-white px-4 outline-none ring-[var(--ps-cyan)] focus:ring-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-bold">Nombre de contacto</span>
        <input
          name="contactName"
          required
          maxLength={80}
          autoComplete="name"
          className="min-h-12 w-full rounded-2xl border border-sky-100 bg-white px-4 outline-none ring-[var(--ps-cyan)] focus:ring-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-bold">Email de contacto</span>
        <input
          name="contactEmail"
          type="email"
          required
          autoComplete="email"
          className="min-h-12 w-full rounded-2xl border border-sky-100 bg-white px-4 outline-none ring-[var(--ps-cyan)] focus:ring-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-bold">Teléfono de contacto</span>
        <input
          name="contactPhone"
          type="tel"
          inputMode="tel"
          required
          autoComplete="tel"
          maxLength={32}
          className="min-h-12 w-full rounded-2xl border border-sky-100 bg-white px-4 outline-none ring-[var(--ps-cyan)] focus:ring-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-bold">Ciudad</span>
        <select
          name="cityId"
          required
          value={cityId}
          onChange={(event) => setCityId(event.target.value)}
          className="min-h-12 w-full rounded-2xl border border-sky-100 bg-white px-4 outline-none ring-[var(--ps-cyan)] focus:ring-2"
        >
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-bold">Zona</span>
        <select
          name="zoneId"
          required
          value={resolvedZoneId}
          onChange={(event) => setZoneId(event.target.value)}
          disabled={filteredZones.length === 0}
          className="min-h-12 w-full rounded-2xl border border-sky-100 bg-white px-4 outline-none ring-[var(--ps-cyan)] focus:ring-2 disabled:opacity-60"
        >
          {filteredZones.length === 0 ? (
            <option value="">Sin zonas para esta ciudad</option>
          ) : (
            filteredZones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))
          )}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-bold">
          Descripción del comercio (opcional)
        </span>
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 outline-none ring-[var(--ps-cyan)] focus:ring-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-bold">Mensaje (opcional)</span>
        <textarea
          name="message"
          rows={3}
          maxLength={2000}
          className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 outline-none ring-[var(--ps-cyan)] focus:ring-2"
        />
      </label>

      {state.error ? (
        <p
          className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || filteredZones.length === 0}
        className="grad-btn min-h-12 w-full rounded-full px-5 text-sm font-extrabold shadow-glow disabled:opacity-60"
      >
        {pending ? "Enviando solicitud…" : "Enviar solicitud"}
      </button>
    </form>
  );
}
