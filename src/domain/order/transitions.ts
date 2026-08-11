import { DomainError } from "../shared/errors";
import { err, ok, type Result } from "../shared/result";
import type { OrderStatus } from "./enums";

const ALLOWED_TRANSITIONS: Readonly<
  Record<OrderStatus, readonly OrderStatus[]>
> = {
  PENDING: ["ACCEPTED", "CANCELED"],
  ACCEPTED: ["PREPARING", "CANCELED"],
  PREPARING: ["READY", "CANCELED"],
  READY: ["COMPLETED", "CANCELED"],
  COMPLETED: [],
  CANCELED: [],
};

export const ORDER_TERMINAL_STATUSES: readonly OrderStatus[] = [
  "COMPLETED",
  "CANCELED",
];

export function isOrderTerminalStatus(status: OrderStatus): boolean {
  return ORDER_TERMINAL_STATUSES.includes(status);
}

export function canTransitionOrderStatus(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function transitionOrderStatus(
  from: OrderStatus,
  to: OrderStatus,
): Result<OrderStatus, DomainError> {
  if (from === to) {
    return err(
      new DomainError(
        "ORDER_TRANSITION_NOOP",
        `Order is already in status ${from}`,
      ),
    );
  }

  if (isOrderTerminalStatus(from)) {
    return err(
      new DomainError(
        "ORDER_TRANSITION_TERMINAL",
        `Cannot transition from terminal status ${from}`,
      ),
    );
  }

  if (!canTransitionOrderStatus(from, to)) {
    return err(
      new DomainError(
        "ORDER_TRANSITION_INVALID",
        `Invalid order transition ${from} -> ${to}`,
      ),
    );
  }

  return ok(to);
}

/**
 * PLATFORM_DELIVERY exists conceptually but must not be used in MVP operations.
 */
export function assertFulfillmentAllowedForMvp(
  method: "PICKUP" | "MERCHANT_DELIVERY" | "PLATFORM_DELIVERY",
): Result<true, DomainError> {
  if (method === "PLATFORM_DELIVERY") {
    return err(
      new DomainError(
        "FULFILLMENT_PLATFORM_DISABLED",
        "PLATFORM_DELIVERY is not enabled in MVP",
      ),
    );
  }
  return ok(true);
}
