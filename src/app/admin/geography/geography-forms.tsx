"use client";

import { useActionState } from "react";
import {
  createCityAction,
  createProvinceAction,
  createZoneAction,
  initialActionState,
} from "../actions";

type ProvinceOption = { id: string; name: string; code: string };
type CityOption = { id: string; name: string; provinceId: string };

type GeographyFormsProps = {
  provinces: ProvinceOption[];
  cities: CityOption[];
};

function Feedback({
  error,
  success,
}: {
  error: string | null;
  success: string | null;
}) {
  if (error) {
    return (
      <p className="text-sm text-red-800" role="alert">
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p className="text-sm text-accent" role="status">
        {success}
      </p>
    );
  }
  return null;
}

export function GeographyForms({ provinces, cities }: GeographyFormsProps) {
  const [provinceState, provinceAction, provincePending] = useActionState(
    createProvinceAction,
    initialActionState,
  );
  const [cityState, cityAction, cityPending] = useActionState(
    createCityAction,
    initialActionState,
  );
  const [zoneState, zoneAction, zonePending] = useActionState(
    createZoneAction,
    initialActionState,
  );

  return (
    <div className="grid gap-10">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Nueva provincia</h2>
        <p className="text-xs text-muted">
          Campos: nombre y código (único, ej. AR-U). No hay columna slug en el
          schema actual.
        </p>
        <form action={provinceAction} className="flex max-w-md flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Nombre</span>
            <input
              name="name"
              required
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Código</span>
            <input
              name="code"
              required
              placeholder="AR-U"
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <Feedback
            error={provinceState.error}
            success={provinceState.success}
          />
          <button
            type="submit"
            disabled={provincePending}
            className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-60"
          >
            {provincePending ? "Guardando…" : "Crear provincia"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Nueva ciudad</h2>
        <form action={cityAction} className="flex max-w-md flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Provincia</span>
            <select
              name="provinceId"
              required
              disabled={provinces.length === 0}
              className="rounded-md border border-border bg-background px-3 py-2"
            >
              {provinces.length === 0 ? (
                <option value="">Creá una provincia primero</option>
              ) : (
                provinces.map((province) => (
                  <option key={province.id} value={province.id}>
                    {province.name} ({province.code})
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Nombre</span>
            <input
              name="name"
              required
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Slug</span>
            <input
              name="slug"
              required
              placeholder="rawson"
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Timezone IANA</span>
            <input
              name="timezone"
              required
              placeholder="America/Argentina/Catamarca"
              defaultValue="America/Argentina/Catamarca"
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <Feedback error={cityState.error} success={cityState.success} />
          <button
            type="submit"
            disabled={cityPending || provinces.length === 0}
            className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-60"
          >
            {cityPending ? "Guardando…" : "Crear ciudad"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Nueva zona</h2>
        <form action={zoneAction} className="flex max-w-md flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Ciudad</span>
            <select
              name="cityId"
              required
              disabled={cities.length === 0}
              className="rounded-md border border-border bg-background px-3 py-2"
            >
              {cities.length === 0 ? (
                <option value="">Creá una ciudad primero</option>
              ) : (
                cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Nombre</span>
            <input
              name="name"
              required
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Slug</span>
            <input
              name="slug"
              required
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <Feedback error={zoneState.error} success={zoneState.success} />
          <button
            type="submit"
            disabled={zonePending || cities.length === 0}
            className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-60"
          >
            {zonePending ? "Guardando…" : "Crear zona"}
          </button>
        </form>
      </section>
    </div>
  );
}
