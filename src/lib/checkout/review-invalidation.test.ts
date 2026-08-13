import { describe, expect, it } from "vitest";
import { CHECKOUT_ERROR_CODES } from "@/application/checkout/errors";
import type { CheckoutReview } from "@/application/checkout/checkout-review";
import {
  markAttemptReviewed,
  resolveAttemptForSignature,
  type CheckoutAttemptState,
} from "./session";
import {
  applyCheckoutActionFailure,
  applyUnknownNetworkOutcome,
  canShowAuthoritativeReview,
  canShowConfirmButton,
} from "./review-invalidation";

function attempt(
  overrides: Partial<CheckoutAttemptState> = {},
): CheckoutAttemptState {
  return {
    idempotencyKey: "key-1",
    requestSignature: "sig-a",
    quoteFingerprint: "fp-old",
    phase: "reviewed",
    ...overrides,
  };
}

function review(overrides: Partial<CheckoutReview> = {}): CheckoutReview {
  return {
    merchantId: "11111111-1111-4111-8111-111111111111",
    merchantName: "Comercio Prueba",
    fulfillmentMethod: "PICKUP",
    lines: [
      {
        productId: "77777777-7777-4777-8777-777777777777",
        productName: "Coca Cola",
        quantity: 1,
        unitPriceCents: 150000,
        lineTotalCents: 150000,
        options: [],
      },
    ],
    itemSubtotalCents: 150000,
    optionsSubtotalCents: 0,
    orderSubtotalCents: 150000,
    deliveryFeeCents: 0,
    totalCents: 150000,
    payment: { code: "CASH", label: "Efectivo", instructions: "" },
    delivery: null,
    quoteFingerprint: "fp-old",
    ...overrides,
  };
}

function confirmVisible(
  slice: {
    review: CheckoutReview | null;
    attempt: CheckoutAttemptState;
    errorCode: string | null;
  },
  extras: {
    merchantAccepting?: boolean;
    requestInFlight?: boolean;
    signature?: string;
  } = {},
): boolean {
  return canShowConfirmButton({
    review: slice.review,
    attempt: slice.attempt,
    errorCode: slice.errorCode,
    merchantAccepting: extras.merchantAccepting ?? true,
    requestInFlight: extras.requestInFlight ?? false,
    requestSignature: extras.signature ?? slice.attempt.requestSignature,
  });
}

describe("stale checkout review invalidation", () => {
  it("clears a valid review after a stock failure", () => {
    const current = { review: review(), attempt: attempt() };
    const next = applyCheckoutActionFailure(current, {
      code: CHECKOUT_ERROR_CODES.PRODUCT_NOT_SELLABLE,
      message:
        "Un producto ya no se puede pedir. Volvé al carrito para corregirlo.",
    });
    expect(next.review).toBeNull();
    expect(next.attempt.quoteFingerprint).toBeNull();
    expect(next.attempt.phase).toBe("form");
    expect(next.attempt.idempotencyKey).toBe("key-1");
    expect(next.errorCode).toBe(CHECKOUT_ERROR_CODES.PRODUCT_NOT_SELLABLE);
    expect(confirmVisible(next)).toBe(false);
    expect(
      canShowAuthoritativeReview({
        review: next.review,
        attempt: next.attempt,
        errorCode: next.errorCode,
        requestSignature: next.attempt.requestSignature,
      }),
    ).toBe(false);
  });

  it("hides confirm after insufficient stock", () => {
    const next = applyCheckoutActionFailure(
      { review: review(), attempt: attempt() },
      {
        code: CHECKOUT_ERROR_CODES.INSUFFICIENT_STOCK,
        message: "No hay stock suficiente.",
      },
    );
    expect(next.review).toBeNull();
    expect(confirmVisible(next)).toBe(false);
  });

  it("clears the quote fingerprint on invalidating errors", () => {
    const next = applyCheckoutActionFailure(
      { review: review(), attempt: attempt() },
      {
        code: CHECKOUT_ERROR_CODES.PRODUCT_NOT_FOUND,
        message: "Un producto del carrito ya no está disponible.",
      },
    );
    expect(next.attempt.quoteFingerprint).toBeNull();
  });

  it("does not touch cart or form fields — only review state", () => {
    const current = { review: review(), attempt: attempt() };
    const next = applyCheckoutActionFailure(current, {
      code: CHECKOUT_ERROR_CODES.PRODUCT_NOT_SELLABLE,
      message: "stale",
    });
    expect(next.attempt.requestSignature).toBe(
      current.attempt.requestSignature,
    );
    expect(next.attempt.idempotencyKey).toBe(current.attempt.idempotencyKey);
    expect(next.clearFrozen).toBe(true);
  });

  it("clears review when the merchant is paused", () => {
    const next = applyCheckoutActionFailure(
      { review: review(), attempt: attempt() },
      {
        code: CHECKOUT_ERROR_CODES.MERCHANT_NOT_ACCEPTING,
        message: "Este comercio no está tomando pedidos en este momento.",
      },
    );
    expect(next.review).toBeNull();
    expect(next.attempt.quoteFingerprint).toBeNull();
    expect(confirmVisible(next)).toBe(false);
    expect(
      confirmVisible(
        { ...next, review: review() },
        { merchantAccepting: false },
      ),
    ).toBe(false);
  });

  it("clears review when the payment method is invalid", () => {
    const next = applyCheckoutActionFailure(
      { review: review(), attempt: attempt() },
      {
        code: CHECKOUT_ERROR_CODES.PAYMENT_METHOD_INVALID,
        message: "El medio de pago no es válido.",
      },
    );
    expect(next.review).toBeNull();
    expect(confirmVisible(next)).toBe(false);
  });

  it("clears review when the delivery zone is not served", () => {
    const next = applyCheckoutActionFailure(
      { review: review(), attempt: attempt() },
      {
        code: CHECKOUT_ERROR_CODES.DELIVERY_ZONE_NOT_SERVED,
        message: "Este comercio no entrega en la zona seleccionada.",
      },
    );
    expect(next.review).toBeNull();
    expect(confirmVisible(next)).toBe(false);
  });

  it("shows the updated review on CHECKOUT_REVIEW_REQUIRED but requires explicit reconfirm of the new quote", () => {
    const updated = review({
      totalCents: 180000,
      quoteFingerprint: "fp-new",
    });
    const next = applyCheckoutActionFailure(
      { review: review(), attempt: attempt() },
      {
        code: CHECKOUT_ERROR_CODES.CHECKOUT_REVIEW_REQUIRED,
        message: "El pedido cambió desde la última revisión.",
        review: updated,
      },
    );
    expect(next.review?.quoteFingerprint).toBe("fp-new");
    expect(next.review?.totalCents).toBe(180000);
    expect(next.attempt.quoteFingerprint).toBe("fp-new");
    expect(next.attempt.quoteFingerprint).not.toBe("fp-old");
    expect(next.errorCode).toBe(CHECKOUT_ERROR_CODES.CHECKOUT_REVIEW_REQUIRED);
    expect(confirmVisible(next)).toBe(true);
  });

  it("keeps retry state and idempotency on unknown network outcome", () => {
    const current = { review: review(), attempt: attempt() };
    const next = applyUnknownNetworkOutcome(current);
    expect(next.review?.quoteFingerprint).toBe("fp-old");
    expect(next.attempt.idempotencyKey).toBe("key-1");
    expect(next.attempt.quoteFingerprint).toBe("fp-old");
    expect(next.attempt.phase).toBe("unknown");
    expect(next.clearFrozen).toBe(false);
    expect(confirmVisible(next)).toBe(false);
    const edited = resolveAttemptForSignature(
      next.attempt,
      "sig-changed",
      () => "key-2",
    );
    expect(edited.idempotencyKey).toBe("key-1");
  });

  it("still allows success/replay to proceed independently of review invalidation", () => {
    const reviewed = markAttemptReviewed(
      attempt({ quoteFingerprint: null, phase: "form" }),
      "fp-old",
    );
    expect(
      canShowConfirmButton({
        review: review(),
        attempt: reviewed,
        errorCode: null,
        merchantAccepting: true,
        requestInFlight: false,
        requestSignature: "sig-a",
      }),
    ).toBe(true);
  });

  it("hides confirm while a request is in flight", () => {
    expect(
      canShowConfirmButton({
        review: review(),
        attempt: attempt(),
        errorCode: null,
        merchantAccepting: true,
        requestInFlight: true,
        requestSignature: "sig-a",
      }),
    ).toBe(false);
  });

  it("invalidates review when the request signature changes after an edit", () => {
    const current = attempt();
    const edited = resolveAttemptForSignature(current, "sig-b", () => "key-2");
    expect(edited.quoteFingerprint).toBeNull();
    expect(edited.phase).toBe("form");
    expect(
      canShowConfirmButton({
        review: review(),
        attempt: edited,
        errorCode: null,
        merchantAccepting: true,
        requestInFlight: false,
        requestSignature: "sig-b",
      }),
    ).toBe(false);
    expect(
      canShowAuthoritativeReview({
        review: review(),
        attempt: edited,
        errorCode: null,
        requestSignature: "sig-b",
      }),
    ).toBe(false);
  });
});
