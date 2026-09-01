import { describe, expect, it } from "vitest";
import { CHECKOUT_ERROR_CODES } from "./errors";
import { checkoutUserMessage, isStaleCartError } from "./user-messages";

describe("checkout user messages", () => {
  it("maps review-required and merchant paused copy", () => {
    expect(
      checkoutUserMessage(CHECKOUT_ERROR_CODES.CHECKOUT_REVIEW_REQUIRED),
    ).toBe(
      "El pedido cambió desde la última revisión. Revisá los datos actualizados antes de confirmar.",
    );
    expect(
      checkoutUserMessage(CHECKOUT_ERROR_CODES.MERCHANT_NOT_ACCEPTING),
    ).toBe("Este comercio no está tomando pedidos en este momento.");
    expect(checkoutUserMessage(CHECKOUT_ERROR_CODES.MERCHANT_CLOSED)).toBe(
      "Este comercio está cerrado en este momento.",
    );
    expect(
      checkoutUserMessage(
        CHECKOUT_ERROR_CODES.DELIVERY_MINIMUM_NOT_MET,
        undefined,
        {
          minimumLabel: "$1.000,00",
        },
      ),
    ).toBe("Para esta zona el pedido mínimo es de $1.000,00.");
  });

  it("marks product/stock errors as stale cart", () => {
    expect(isStaleCartError(CHECKOUT_ERROR_CODES.INSUFFICIENT_STOCK)).toBe(
      true,
    );
    expect(isStaleCartError(CHECKOUT_ERROR_CODES.PRODUCT_NOT_SELLABLE)).toBe(
      true,
    );
    expect(isStaleCartError(CHECKOUT_ERROR_CODES.CONTACT_INVALID)).toBe(false);
  });
});
