import { PAYMENT_METHOD_CODES, type PaymentMethodCode } from "./enums";

/**
 * Canonical public labels. Merchants cannot rename technical codes.
 * Payment remains cliente → comercio; these are not platform processors.
 */
export const PAYMENT_METHOD_CANONICAL_LABELS: Record<
  PaymentMethodCode,
  string
> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  MERCADO_PAGO: "Mercado Pago",
};

export const PAYMENT_METHOD_SORT_ORDER: Record<PaymentMethodCode, number> = {
  CASH: 0,
  TRANSFER: 1,
  MERCADO_PAGO: 2,
};

export const PAYMENT_METHOD_CUSTOMER_COPY: Record<PaymentMethodCode, string> = {
  CASH: "El cliente paga en efectivo.",
  TRANSFER: "El cliente realiza una transferencia directamente al comercio.",
  MERCADO_PAGO:
    "El cliente paga usando los datos de Mercado Pago del comercio.",
};

export const PAYMENT_INSTRUCTIONS_MAX_LENGTH = 2000;

export function isPaymentMethodCode(value: string): value is PaymentMethodCode {
  return (PAYMENT_METHOD_CODES as readonly string[]).includes(value);
}

export function canonicalPaymentMethodLabel(code: PaymentMethodCode): string {
  return PAYMENT_METHOD_CANONICAL_LABELS[code];
}
