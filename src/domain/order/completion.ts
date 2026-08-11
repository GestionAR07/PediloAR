import type { Delivery } from "../delivery/types";
import { DomainError } from "../shared/errors";
import { err, ok, type Result } from "../shared/result";
import type { FulfillmentMethod, OrderStatus } from "./enums";

/**
 * Pure policy: when an Order in READY may transition to COMPLETED.
 * Does not embed logistics states into Order.
 */
export type CompleteOrderContext = {
  orderStatus: OrderStatus;
  fulfillmentMethod: FulfillmentMethod;
  /**
   * Required (and must be DELIVERED) for MERCHANT_DELIVERY / PLATFORM_DELIVERY.
   * Ignored for PICKUP (must not be required).
   */
  delivery?: Pick<Delivery, "status"> | null;
};

export function canCompleteOrder(
  context: CompleteOrderContext,
): Result<true, DomainError> {
  const { orderStatus, fulfillmentMethod, delivery } = context;

  if (orderStatus !== "READY") {
    return err(
      new DomainError(
        "ORDER_COMPLETE_NOT_READY",
        `Order must be READY to complete (current: ${orderStatus})`,
      ),
    );
  }

  if (fulfillmentMethod === "PICKUP") {
    // Merchant confirms customer pickup — no Delivery entity.
    return ok(true);
  }

  if (
    fulfillmentMethod === "MERCHANT_DELIVERY" ||
    fulfillmentMethod === "PLATFORM_DELIVERY"
  ) {
    if (delivery == null) {
      return err(
        new DomainError(
          "ORDER_COMPLETE_DELIVERY_REQUIRED",
          `${fulfillmentMethod} requires a Delivery in DELIVERED status to complete`,
        ),
      );
    }

    if (delivery.status !== "DELIVERED") {
      return err(
        new DomainError(
          "ORDER_COMPLETE_DELIVERY_NOT_DELIVERED",
          `${fulfillmentMethod} can complete only when Delivery is DELIVERED (current: ${delivery.status})`,
        ),
      );
    }

    return ok(true);
  }

  return err(
    new DomainError(
      "ORDER_COMPLETE_UNKNOWN_FULFILLMENT",
      `Unknown fulfillment method: ${String(fulfillmentMethod)}`,
    ),
  );
}

export function assertCanCompleteOrder(context: CompleteOrderContext): void {
  const result = canCompleteOrder(context);
  if (!result.ok) {
    throw result.error;
  }
}
