import { describe, expect, it } from "vitest";
import { PAYMENT_METHOD_CODES } from "./enums";
import {
  canonicalPaymentMethodLabel,
  isPaymentMethodCode,
  PAYMENT_METHOD_CANONICAL_LABELS,
} from "./payment-methods";

describe("canonical payment method labels", () => {
  it("covers every supported code and rejects unknown codes", () => {
    expect(Object.keys(PAYMENT_METHOD_CANONICAL_LABELS).sort()).toEqual(
      [...PAYMENT_METHOD_CODES].sort(),
    );
    expect(canonicalPaymentMethodLabel("CASH")).toBe("Efectivo");
    expect(canonicalPaymentMethodLabel("TRANSFER")).toBe("Transferencia");
    expect(canonicalPaymentMethodLabel("MERCADO_PAGO")).toBe("Mercado Pago");
    expect(isPaymentMethodCode("CASH")).toBe(true);
    expect(isPaymentMethodCode("WALLET")).toBe(false);
  });
});
