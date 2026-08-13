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
    <form action={formAction} className="flex flex-col gap-6">
      {noneActive ? (
        <p
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          role="status"
        >
          Necesitás activar al menos un medio de pago para recibir pedidos.
        </p>
      ) : null}

      {methods.map((method) => (
        <section
          key={method.code}
          className="space-y-3 border-b border-border pb-6 last:border-b-0 last:pb-0"
        >
          <header className="space-y-1">
            <h2 className="text-lg font-semibold">{method.label}</h2>
            <p className="text-sm text-muted">
              {PAYMENT_METHOD_CUSTOMER_COPY[method.code]}
            </p>
          </header>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={`active_${method.code}`}
              defaultChecked={method.active}
            />
            <span>Activo</span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Instrucciones para el cliente</span>
            <textarea
              name={`instructions_${method.code}`}
              rows={3}
              maxLength={PAYMENT_INSTRUCTIONS_MAX_LENGTH}
              defaultValue={method.instructions}
              placeholder={INSTRUCTION_HINT[method.code] ?? undefined}
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
        </section>
      ))}

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
