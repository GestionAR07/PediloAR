import { CHECKOUT_ERROR_CODES } from "@/application/checkout/errors";
import type { CheckoutReview } from "@/application/checkout/checkout-review";
import {
  clearAttemptQuote,
  markAttemptReviewed,
  markAttemptUnknown,
  type CheckoutAttemptState,
} from "./session";

/**
 * Business errors that prove the last authoritative review is no longer
 * confirmable. Network-unknown is not in this list.
 */
export const REVIEW_INVALIDATING_ERROR_CODES = [
  CHECKOUT_ERROR_CODES.MERCHANT_NOT_ACCEPTING,
  CHECKOUT_ERROR_CODES.MERCHANT_CLOSED,
  CHECKOUT_ERROR_CODES.PRODUCT_NOT_FOUND,
  CHECKOUT_ERROR_CODES.PRODUCT_NOT_SELLABLE,
  CHECKOUT_ERROR_CODES.INSUFFICIENT_STOCK,
  CHECKOUT_ERROR_CODES.INVALID_OPTION_SELECTION,
  CHECKOUT_ERROR_CODES.PICKUP_UNAVAILABLE,
  CHECKOUT_ERROR_CODES.DELIVERY_ZONE_NOT_SERVED,
  CHECKOUT_ERROR_CODES.DELIVERY_MINIMUM_NOT_MET,
  CHECKOUT_ERROR_CODES.PAYMENT_METHOD_INVALID,
  CHECKOUT_ERROR_CODES.CHECKOUT_REVIEW_REQUIRED,
  CHECKOUT_ERROR_CODES.PRODUCT_FOREIGN_MERCHANT,
  CHECKOUT_ERROR_CODES.EMPTY_CART,
  CHECKOUT_ERROR_CODES.MERCHANT_NOT_FOUND,
] as const;

export type CheckoutActionFailureInput = {
  code: string;
  message: string;
  review?: CheckoutReview | null;
};

export type CheckoutReviewUiSlice = {
  review: CheckoutReview | null;
  attempt: CheckoutAttemptState;
  error: string | null;
  errorCode: string | null;
  clearFrozen: boolean;
};

export function isReviewInvalidatingError(code: string | null): boolean {
  if (!code) return false;
  return (REVIEW_INVALIDATING_ERROR_CODES as readonly string[]).includes(code);
}

export function applyCheckoutActionFailure(
  current: {
    review: CheckoutReview | null;
    attempt: CheckoutAttemptState;
  },
  failure: CheckoutActionFailureInput,
): CheckoutReviewUiSlice {
  if (
    failure.code === CHECKOUT_ERROR_CODES.CHECKOUT_REVIEW_REQUIRED &&
    failure.review
  ) {
    return {
      review: failure.review,
      attempt: markAttemptReviewed(
        { ...current.attempt, phase: "form" },
        failure.review.quoteFingerprint,
      ),
      error: failure.message,
      errorCode: failure.code,
      clearFrozen: true,
    };
  }

  if (isReviewInvalidatingError(failure.code)) {
    return {
      review: null,
      attempt: clearAttemptQuote(current.attempt),
      error: failure.message,
      errorCode: failure.code,
      clearFrozen: true,
    };
  }

  return {
    review: current.review,
    attempt: current.attempt,
    error: failure.message,
    errorCode: failure.code,
    clearFrozen: true,
  };
}

export function applyUnknownNetworkOutcome(current: {
  review: CheckoutReview | null;
  attempt: CheckoutAttemptState;
}): CheckoutReviewUiSlice {
  return {
    review: current.review,
    attempt: markAttemptUnknown(current.attempt),
    error: "No pudimos confirmar la respuesta del servidor.",
    errorCode: "NETWORK_UNKNOWN",
    clearFrozen: false,
  };
}

export function canShowConfirmButton(input: {
  review: CheckoutReview | null;
  attempt: CheckoutAttemptState;
  errorCode: string | null;
  merchantAccepting: boolean;
  requestInFlight: boolean;
  requestSignature: string;
}): boolean {
  if (input.requestInFlight) return false;
  if (!input.merchantAccepting) return false;
  if (input.attempt.phase === "unknown") return false;
  if (!input.review) return false;
  if (!input.attempt.quoteFingerprint) return false;
  if (input.attempt.phase !== "reviewed") return false;
  if (input.attempt.quoteFingerprint !== input.review.quoteFingerprint) {
    return false;
  }
  if (input.attempt.requestSignature !== input.requestSignature) {
    return false;
  }
  if (
    input.errorCode &&
    isReviewInvalidatingError(input.errorCode) &&
    input.errorCode !== CHECKOUT_ERROR_CODES.CHECKOUT_REVIEW_REQUIRED
  ) {
    return false;
  }
  return true;
}

export function canShowAuthoritativeReview(input: {
  review: CheckoutReview | null;
  attempt: CheckoutAttemptState;
  errorCode: string | null;
  requestSignature: string;
}): boolean {
  if (!input.review) return false;
  if (!input.attempt.quoteFingerprint) return false;
  if (input.attempt.phase === "unknown") return false;
  if (input.attempt.quoteFingerprint !== input.review.quoteFingerprint) {
    return false;
  }
  if (input.attempt.requestSignature !== input.requestSignature) {
    return false;
  }
  if (
    input.errorCode &&
    isReviewInvalidatingError(input.errorCode) &&
    input.errorCode !== CHECKOUT_ERROR_CODES.CHECKOUT_REVIEW_REQUIRED
  ) {
    return false;
  }
  return true;
}
