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
    <form action={formAction} className="merchant-workspace-form">
      <label className="merchant-workspace-card merchant-workspace-toggle-card merchant-workspace-toggle-card--switch">
        <input
          type="checkbox"
          name="merchant_delivery_enabled"
          defaultChecked={settings.merchantDeliveryEnabled}
          className="merchant-workspace-switch-input merchant-workspace-switch-input--overlay"
        />
        <div className="merchant-workspace-toggle-copy min-w-0">
          <span className="merchant-workspace-card-title">
            Ofrecer envío a domicilio
          </span>
          <span className="merchant-workspace-card-copy">
            Los clientes podrán elegir entrega en las zonas que tengas activas.
          </span>
        </div>
        <span
          className="merchant-workspace-switch-track merchant-workspace-switch-track--decor"
          aria-hidden="true"
        />
      </label>

      {settings.zones.length === 0 ? (
        <p className="merchant-workspace-empty" role="status">
          No hay zonas geográficas en {settings.cityName} para configurar
          envíos.
        </p>
      ) : (
        <div className="merchant-workspace-zone-grid">
          {settings.zones.map((zone) => (
            <section
              key={zone.zoneId}
              className="merchant-workspace-card merchant-workspace-zone-card"
            >
              <input type="hidden" name="zone_id" value={zone.zoneId} />
              <header className="merchant-workspace-zone-header">
                <div>
                  <h2 className="merchant-workspace-card-title">
                    {zone.zoneName}
                  </h2>
                  <p className="merchant-workspace-card-copy">
                    {zone.cityName}
                  </p>
                </div>
                <label className="merchant-workspace-active-pill">
                  <input
                    type="checkbox"
                    name={`active_${zone.zoneId}`}
                    defaultChecked={zone.active}
                    className="merchant-workspace-checkbox"
                  />
                  <span>Activa</span>
                </label>
              </header>

              <div className="merchant-workspace-zone-fields">
                <label className="merchant-workspace-field">
                  <span>Costo de envío</span>
                  <input
                    type="text"
                    name={`fee_${zone.zoneId}`}
                    inputMode="decimal"
                    defaultValue={moneyDefault(zone.deliveryFeeCents)}
                    placeholder="$ 0,00"
                    className="merchant-workspace-input"
                  />
                </label>

                <label className="merchant-workspace-field">
                  <span>Pedido mínimo</span>
                  <input
                    type="text"
                    name={`minimum_${zone.zoneId}`}
                    inputMode="decimal"
                    defaultValue={moneyDefault(zone.minimumOrderCents)}
                    placeholder="$ 0,00"
                    className="merchant-workspace-input"
                  />
                </label>

                <label className="merchant-workspace-field">
                  <span>Tiempo estimado</span>
                  <span className="merchant-workspace-inline-input">
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
                      className="merchant-workspace-input merchant-workspace-input--narrow"
                    />
                    <span className="text-sm text-[#5b5470]">minutos</span>
                  </span>
                </label>
              </div>
            </section>
          ))}
        </div>
      )}

      {state.error ? (
        <p
          className="merchant-workspace-alert merchant-workspace-alert--error"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p
          className="merchant-workspace-alert merchant-workspace-alert--success"
          role="status"
        >
          {state.success}
        </p>
      ) : null}

      <div className="merchant-workspace-form-actions">
        <button
          type="submit"
          disabled={pending}
          className="merchant-workspace-primary-btn"
        >
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
