"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { PaymentMethodSettingView } from "@/application/merchant/payment-methods";
import {
  PAYMENT_INSTRUCTIONS_MAX_LENGTH,
  PAYMENT_METHOD_CUSTOMER_COPY,
} from "@/domain/merchant/payment-methods";
import { saveMerchantPaymentMethodsAction } from "./actions";
import type { PaymentMethodActionState } from "./action-state";

type Props = {
  merchantId: string;
  methods: PaymentMethodSettingView[];
};

const initialState: PaymentMethodActionState = {
  error: null,
  success: null,
};

const INSTRUCTION_HINT: Record<string, string | null> = {
  CASH: "Opcional. Ej.: Pagás al recibir tu pedido.",
  TRANSFER: "Ej.: Transferí al alias XXXXX y enviá el comprobante.",
  MERCADO_PAGO: "Ej.: Pagá al alias/QR indicado por el comercio.",
};

export function PaymentMethodsForm({ merchantId, methods }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    saveMerchantPaymentMethodsAction.bind(null, merchantId),
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  const noneActive = methods.every((method) => !method.active);

  return (
    <form action={formAction} className="merchant-workspace-form">
      {noneActive ? (
        <p
          className="merchant-workspace-alert merchant-workspace-alert--warning"
          role="status"
        >
          Necesitás activar al menos un medio de pago para recibir pedidos.
        </p>
      ) : null}

      <div className="merchant-workspace-payment-grid">
        {methods.map((method) => (
          <section
            key={method.code}
            className="merchant-workspace-card merchant-workspace-payment-card"
          >
            <header className="merchant-workspace-zone-header">
              <div>
                <h2 className="merchant-workspace-card-title">
                  {method.label}
                </h2>
                <p className="merchant-workspace-card-copy">
                  {PAYMENT_METHOD_CUSTOMER_COPY[method.code]}
                </p>
              </div>
              <label className="merchant-workspace-active-pill">
                <input
                  type="checkbox"
                  name={`active_${method.code}`}
                  defaultChecked={method.active}
                  className="merchant-workspace-checkbox"
                />
                <span>Activo</span>
              </label>
            </header>

            <label className="merchant-workspace-field">
              <span>Instrucciones para el cliente</span>
              <textarea
                name={`instructions_${method.code}`}
                rows={4}
                maxLength={PAYMENT_INSTRUCTIONS_MAX_LENGTH}
                defaultValue={method.instructions}
                placeholder={INSTRUCTION_HINT[method.code] ?? undefined}
                className="merchant-workspace-input merchant-workspace-textarea"
              />
            </label>
          </section>
        ))}
      </div>

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

      <button
        type="submit"
        disabled={pending}
        className="merchant-workspace-primary-btn"
      >
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
