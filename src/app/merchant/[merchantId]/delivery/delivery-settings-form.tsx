"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { moneyCents } from "@/domain/money/money-cents";
import { formatMoneyCentsArs } from "@/lib/format-money";
import type { DeliverySettingsView } from "@/application/merchant/delivery-settings";
import { saveMerchantDeliverySettingsAction } from "./actions";
import type { DeliverySettingsActionState } from "./action-state";

type Props = {
  merchantId: string;
  settings: DeliverySettingsView;
};

const initialState: DeliverySettingsActionState = {
  error: null,
  success: null,
};

function moneyDefault(cents: number | null): string {
  if (cents === null) {
    return "";
  }
  return formatMoneyCentsArs(moneyCents(cents));
}

export function DeliverySettingsForm({ merchantId, settings }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    saveMerchantDeliverySettingsAction.bind(null, merchantId),
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="merchant_delivery_enabled"
          defaultChecked={settings.merchantDeliveryEnabled}
          className="mt-1"
        />
        <span>
          <span className="block font-medium">
            Realizo envíos con el comercio
          </span>
          <span className="block text-muted">
            Si lo desactivás, el checkout no ofrece envío a domicilio. Las zonas
            configuradas se conservan.
          </span>
        </span>
      </label>

      {settings.zones.length === 0 ? (
        <p className="text-sm text-muted" role="status">
          No hay zonas geográficas en {settings.cityName} para configurar
          envíos.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {settings.zones.map((zone) => (
            <section
              key={zone.zoneId}
              className="space-y-3 border-b border-border pb-6 last:border-b-0 last:pb-0"
            >
              <input type="hidden" name="zone_id" value={zone.zoneId} />
              <header className="space-y-1">
                <h2 className="text-lg font-semibold">{zone.zoneName}</h2>
                <p className="text-sm text-muted">{zone.cityName}</p>
              </header>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={`active_${zone.zoneId}`}
                  defaultChecked={zone.active}
                />
                <span>Activa</span>
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Costo de envío</span>
                <input
                  type="text"
                  name={`fee_${zone.zoneId}`}
                  inputMode="decimal"
                  defaultValue={moneyDefault(zone.deliveryFeeCents)}
                  placeholder="$ 0,00"
                  className="rounded-md border border-border bg-background px-3 py-2"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Pedido mínimo</span>
                <input
                  type="text"
                  name={`minimum_${zone.zoneId}`}
                  inputMode="decimal"
                  defaultValue={moneyDefault(zone.minimumOrderCents)}
                  placeholder="$ 0,00"
                  className="rounded-md border border-border bg-background px-3 py-2"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Tiempo estimado</span>
                <span className="flex items-center gap-2">
                  <input
                    type="text"
                    name={`estimated_minutes_${zone.zoneId}`}
                    inputMode="numeric"
                    defaultValue={
                      zone.estimatedMinutes === null
                        ? ""
                        : String(zone.estimatedMinutes)
                    }
                    placeholder="30"
                    className="w-24 rounded-md border border-border bg-background px-3 py-2"
                  />
                  <span className="text-muted">minutos</span>
                </span>
              </label>
            </section>
          ))}
        </div>
      )}

      {state.error ? (
        <p className="text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p
          className="rounded-md border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-medium text-accent"
          role="status"
        >
          {state.success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
