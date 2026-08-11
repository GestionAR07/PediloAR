"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createMerchantActionWithId,
  type CreateMerchantActionState,
} from "../actions";

export type CityOption = {
  id: string;
  name: string;
};

export type ZoneOption = {
  id: string;
  cityId: string;
  name: string;
};

type MerchantCreateFormProps = {
  cities: CityOption[];
  zones: ZoneOption[];
};

const initial: CreateMerchantActionState = {
  error: null,
  success: null,
};

export function MerchantCreateForm({ cities, zones }: MerchantCreateFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createMerchantActionWithId,
    initial,
  );
  const [cityId, setCityId] = useState(cities[0]?.id ?? "");

  const filteredZones = useMemo(
    () => zones.filter((zone) => zone.cityId === cityId),
    [zones, cityId],
  );

  useEffect(() => {
    if (state.merchantId) {
      router.push(`/admin/merchants/${state.merchantId}`);
      router.refresh();
    }
  }, [state.merchantId, router]);

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Nombre</span>
        <input
          name="name"
          required
          className="rounded-md border border-border bg-background px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Slug</span>
        <input
          name="slug"
          required
          placeholder="mi-comercio"
          className="rounded-md border border-border bg-background px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Descripción (opcional)</span>
        <textarea
          name="description"
          rows={3}
          className="rounded-md border border-border bg-background px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Ciudad</span>
        <select
          name="cityId"
          required
          value={cityId}
          onChange={(event) => setCityId(event.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2"
        >
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Zona</span>
        <select
          name="zoneId"
          required
          className="rounded-md border border-border bg-background px-3 py-2"
          disabled={filteredZones.length === 0}
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

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="pickupEnabled" defaultChecked />
        <span>Retiro habilitado</span>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="merchantDeliveryEnabled" />
        <span>Delivery propio habilitado</span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">
          Tiempo estimado de preparación (minutos)
        </span>
        <input
          type="number"
          name="preparationMinutes"
          min={0}
          max={1440}
          defaultValue={30}
          required
          className="rounded-md border border-border bg-background px-3 py-2"
        />
      </label>

      <p className="text-xs text-muted">
        El comercio se crea siempre en estado DRAFT. Delivery de plataforma
        permanece deshabilitado.
      </p>

      {state.error ? (
        <p className="text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || filteredZones.length === 0}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Creando…" : "Crear comercio"}
      </button>
    </form>
  );
}
