import type { Delivery } from "../delivery/types";
import { DomainError } from "../shared/errors";
import { err, ok, type Result } from "../shared/result";
import {
  CANCEL_REASONS,
  type CancelReason,
  type OrderActorType,
  type OrderStatus,
} from "./enums";
import { isOrderTerminalStatus } from "./transitions";

/**
 * Pure MVP cancellation policy for Order.
 * Application layer applies this before mutating status → CANCELED.
 *
 * Delivery logistics incidents (e.g. IN_TRANSIT problems) must be resolved
 * on the Delivery machine first (FAILED / CANCELED), then Order cancellation
 * can proceed via application/admin flows.
 */
export type CancelOrderContext = {
  actor: OrderActorType;
  orderStatus: OrderStatus;
  /**
   * Optional linked delivery. When status is IN_TRANSIT, normal order
   * cancellation is blocked for all actors.
   */
  delivery?: Pick<Delivery, "status"> | null;
  /**
   * Required for SYSTEM actor (controlled explicit reason).
   * Recommended for audit for all actors; application should persist it.
   */
  cancelReason?: CancelReason | null;
};

const CUSTOMER_CANCELABLE: ReadonlySet<OrderStatus> = new Set(["PENDING"]);

const MERCHANT_CANCELABLE: ReadonlySet<OrderStatus> = new Set([
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY",
]);

function hasInTransitDelivery(
  delivery: CancelOrderContext["delivery"],
): boolean {
  return delivery != null && delivery.status === "IN_TRANSIT";
}

export function canCancelOrder(
  context: CancelOrderContext,
): Result<true, DomainError> {
  const { actor, orderStatus, delivery, cancelReason } = context;

  if (isOrderTerminalStatus(orderStatus)) {
    return err(
      new DomainError(
        "ORDER_CANCEL_TERMINAL",
        `Cannot cancel order in terminal status ${orderStatus}`,
      ),
    );
  }

  if (hasInTransitDelivery(delivery)) {
    return err(
      new DomainError(
        "ORDER_CANCEL_DELIVERY_IN_TRANSIT",
        "Cannot cancel order while delivery is IN_TRANSIT; resolve delivery first (FAILED/CANCELED)",
      ),
    );
  }

  switch (actor) {
    case "CUSTOMER":
      if (!CUSTOMER_CANCELABLE.has(orderStatus)) {
        return err(
          new DomainError(
            "ORDER_CANCEL_ACTOR_FORBIDDEN",
            "CUSTOMER may only cancel orders in PENDING status",
          ),
        );
      }
      return ok(true);

    case "MERCHANT_USER":
      if (!MERCHANT_CANCELABLE.has(orderStatus)) {
        return err(
          new DomainError(
            "ORDER_CANCEL_ACTOR_FORBIDDEN",
            "MERCHANT_USER may cancel PENDING, ACCEPTED, PREPARING, or READY only",
          ),
        );
      }
      return ok(true);

    case "ADMIN":
      // Non-terminal already checked; auditable intervention is application concern.
      return ok(true);

    case "SYSTEM":
      if (cancelReason == null) {
        return err(
          new DomainError(
            "ORDER_CANCEL_SYSTEM_REASON_REQUIRED",
            "SYSTEM cancellation requires an explicit controlled cancelReason",
          ),
        );
      }
      return ok(true);

    default: {
      const _exhaustive: never = actor;
      return err(
        new DomainError(
          "ORDER_CANCEL_UNKNOWN_ACTOR",
          `Unknown cancel actor: ${String(_exhaustive)}`,
        ),
      );
    }
  }
}

export function assertCanCancelOrder(context: CancelOrderContext): void {
  const result = canCancelOrder(context);
  if (!result.ok) {
    throw result.error;
  }
}

/**
 * Controlled cancel reasons only — matches orders.cancel_reason CHECK.
 */
export function parseCancelReason(
  raw: string,
): Result<CancelReason, DomainError> {
  if (typeof raw !== "string") {
    return err(
      new DomainError(
        "ORDER_CANCEL_REASON_INVALID",
        "Cancel reason must be a string",
      ),
    );
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return err(
      new DomainError("ORDER_CANCEL_REASON_EMPTY", "Cancel reason is required"),
    );
  }

  if (!CANCEL_REASONS.includes(trimmed as CancelReason)) {
    return err(
      new DomainError(
        "ORDER_CANCEL_REASON_INVALID",
        "Cancel reason is not a controlled value",
      ),
    );
  }

  return ok(trimmed as CancelReason);
}
