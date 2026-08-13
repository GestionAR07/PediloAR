import type { CheckoutReview } from "@/application/checkout/checkout-review";
import type { PublicPlacedOrder } from "@/application/checkout/placed-order-view";
import type { CheckoutConfiguration } from "@/application/checkout/configuration";

export type CheckoutActionFailure = {
  ok: false;
  code: string;
  message: string;
  review: CheckoutReview | null;
};

export type CheckoutConfigActionResult =
  { ok: true; configuration: CheckoutConfiguration } | CheckoutActionFailure;

export type CheckoutReviewActionResult =
  { ok: true; review: CheckoutReview } | CheckoutActionFailure;

export type CheckoutPlaceActionResult =
  { ok: true; order: PublicPlacedOrder } | CheckoutActionFailure;
