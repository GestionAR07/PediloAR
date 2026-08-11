import type { Delivery } from "../delivery/types";
import { DomainError } from "../shared/errors";
import { err, ok, type Result } from "../shared/result";
import type { FulfillmentMethod } from "./enums";

/**
 * Pure compatibility check between Order fulfillment and optional Delivery.
 *
 * Relationship remains unidirectional: Delivery.orderId → Order.id.
 * Order does not hold deliveryId. Atomic Order+Delivery creation for
 * delivery methods is an application/persistence concern (Phase 2B+).
 *
 * Does not require Delivery to exist at construction time for delivery methods
 * (avoids artificial temporal coupling).
 */
export type OrderFulfillmentRef = {
  fulfillmentMethod: FulfillmentMethod;
};

export type DeliveryCompatibilityRef = Pick<Delivery, "provider">;

export function assertOrderDeliveryCompatibility(
  order: OrderFulfillmentRef,
  delivery?: DeliveryCompatibilityRef | null,
): Result<true, DomainError> {
  const { fulfillmentMethod } = order;

  if (fulfillmentMethod === "PICKUP") {
    if (delivery != null) {
      return err(
        new DomainError(
          "ORDER_DELIVERY_PICKUP_HAS_DELIVERY",
          "PICKUP orders must not have a Delivery",
        ),
      );
    }
    return ok(true);
  }

  if (delivery == null) {
    // Delivery may be attached later in the same application transaction.
    return ok(true);
  }

  if (fulfillmentMethod === "MERCHANT_DELIVERY") {
    if (delivery.provider !== "MERCHANT") {
      return err(
        new DomainError(
          "ORDER_DELIVERY_PROVIDER_MISMATCH",
          "MERCHANT_DELIVERY requires Delivery provider MERCHANT",
        ),
      );
    }
    return ok(true);
  }

  if (fulfillmentMethod === "PLATFORM_DELIVERY") {
    if (delivery.provider !== "PLATFORM") {
      return err(
        new DomainError(
          "ORDER_DELIVERY_PROVIDER_MISMATCH",
          "PLATFORM_DELIVERY requires Delivery provider PLATFORM",
        ),
      );
    }
    return ok(true);
  }

  return err(
    new DomainError(
      "ORDER_DELIVERY_UNKNOWN_FULFILLMENT",
      `Unknown fulfillment method: ${String(fulfillmentMethod)}`,
    ),
  );
}
