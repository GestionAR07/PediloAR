"use server";

import type { CheckoutReview } from "@/application/checkout/checkout-review";
import { CHECKOUT_ERROR_CODES } from "@/application/checkout/errors";
import { parseCheckoutPayload } from "@/application/checkout/parse-checkout-input";
import { toPublicPlacedOrder } from "@/application/checkout/placed-order-view";
import { checkoutUserMessage } from "@/application/checkout/user-messages";
import {
  getCheckoutConfigurationApp,
  placeOrderApp,
  reviewCheckoutApp,
} from "@/application/checkout/wiring";
import { hasDatabaseConfig } from "@/infrastructure/db/env";
import { isValidUuid } from "@/lib/uuid";
import type {
  CheckoutActionFailure,
  CheckoutConfigActionResult,
  CheckoutPlaceActionResult,
  CheckoutReviewActionResult,
} from "./action-state";

function unavailable(): CheckoutActionFailure {
  return {
    ok: false,
    code: CHECKOUT_ERROR_CODES.CHECKOUT_PAYLOAD_INVALID,
    message: "El checkout no está disponible en este momento.",
    review: null,
  };
}

function failure(
  code: string,
  message?: string,
  review?: CheckoutReview | null,
): CheckoutActionFailure {
  return {
    ok: false,
    code,
    message: checkoutUserMessage(code, message),
    review: review ?? null,
  };
}

export async function getCheckoutConfigurationAction(
  merchantId: string,
): Promise<CheckoutConfigActionResult> {
  if (!hasDatabaseConfig()) {
    return unavailable();
  }
  if (typeof merchantId !== "string" || !isValidUuid(merchantId)) {
    return failure(
      CHECKOUT_ERROR_CODES.MERCHANT_NOT_FOUND,
      "El comercio no existe.",
    );
  }

  try {
    const configuration = await getCheckoutConfigurationApp(merchantId);
    if (!configuration) {
      return failure(
        CHECKOUT_ERROR_CODES.MERCHANT_NOT_FOUND,
        "El comercio no existe.",
      );
    }
    return { ok: true, configuration };
  } catch {
    return unavailable();
  }
}

export async function reviewCheckoutAction(
  payload: unknown,
): Promise<CheckoutReviewActionResult> {
  if (!hasDatabaseConfig()) {
    return unavailable();
  }

  const parsed = parseCheckoutPayload(payload);
  if (!parsed.ok) {
    return failure(parsed.error.code, parsed.error.message);
  }

  try {
    const result = await reviewCheckoutApp(parsed.value);
    if (!result.ok) {
      return failure(
        result.error.code,
        result.error.message,
        result.error.review,
      );
    }
    return { ok: true, review: result.value };
  } catch {
    return unavailable();
  }
}

export async function placeOrderAction(
  payload: unknown,
): Promise<CheckoutPlaceActionResult> {
  if (!hasDatabaseConfig()) {
    return unavailable();
  }

  const parsed = parseCheckoutPayload(payload);
  if (!parsed.ok) {
    return failure(parsed.error.code, parsed.error.message);
  }

  const expected = parsed.value.expectedQuoteFingerprint?.trim() ?? "";
  if (!expected) {
    return failure(
      CHECKOUT_ERROR_CODES.CHECKOUT_REVIEW_REQUIRED,
      "Revisá el pedido antes de confirmar.",
    );
  }

  const result = await placeOrderApp(parsed.value);
  if (!result.ok) {
    return failure(
      result.error.code,
      result.error.message,
      result.error.review,
    );
  }
  return {
    ok: true,
    order: toPublicPlacedOrder(result.value),
  };
}
