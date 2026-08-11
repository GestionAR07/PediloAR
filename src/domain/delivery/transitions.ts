import { DomainError } from "../shared/errors";
import { err, ok, type Result } from "../shared/result";
import type { DeliveryProvider, DeliveryStatus } from "./enums";

const TERMINAL: readonly DeliveryStatus[] = ["DELIVERED", "FAILED", "CANCELED"];

const MERCHANT_TRANSITIONS: Readonly<
  Record<DeliveryStatus, readonly DeliveryStatus[]>
> = {
  PENDING: ["IN_TRANSIT", "FAILED", "CANCELED"],
  REQUESTED: [],
  ASSIGNED: [],
  PICKED_UP: [],
  IN_TRANSIT: ["DELIVERED", "FAILED", "CANCELED"],
  DELIVERED: [],
  FAILED: [],
  CANCELED: [],
};

const PLATFORM_TRANSITIONS: Readonly<
  Record<DeliveryStatus, readonly DeliveryStatus[]>
> = {
  PENDING: ["REQUESTED", "FAILED", "CANCELED"],
  REQUESTED: ["ASSIGNED", "FAILED", "CANCELED"],
  ASSIGNED: ["PICKED_UP", "FAILED", "CANCELED"],
  PICKED_UP: ["IN_TRANSIT", "FAILED", "CANCELED"],
  IN_TRANSIT: ["DELIVERED", "FAILED", "CANCELED"],
  DELIVERED: [],
  FAILED: [],
  CANCELED: [],
};

function transitionsFor(
  provider: DeliveryProvider,
): Readonly<Record<DeliveryStatus, readonly DeliveryStatus[]>> {
  return provider === "MERCHANT" ? MERCHANT_TRANSITIONS : PLATFORM_TRANSITIONS;
}

export function isDeliveryTerminalStatus(status: DeliveryStatus): boolean {
  return TERMINAL.includes(status);
}

export function canTransitionDeliveryStatus(
  provider: DeliveryProvider,
  from: DeliveryStatus,
  to: DeliveryStatus,
): boolean {
  return transitionsFor(provider)[from].includes(to);
}

export function transitionDeliveryStatus(
  provider: DeliveryProvider,
  from: DeliveryStatus,
  to: DeliveryStatus,
): Result<DeliveryStatus, DomainError> {
  if (from === to) {
    return err(
      new DomainError(
        "DELIVERY_TRANSITION_NOOP",
        `Delivery is already in status ${from}`,
      ),
    );
  }

  if (isDeliveryTerminalStatus(from)) {
    return err(
      new DomainError(
        "DELIVERY_TRANSITION_TERMINAL",
        `Cannot transition from terminal status ${from}`,
      ),
    );
  }

  if (!canTransitionDeliveryStatus(provider, from, to)) {
    return err(
      new DomainError(
        "DELIVERY_TRANSITION_INVALID",
        `Invalid ${provider} delivery transition ${from} -> ${to}`,
      ),
    );
  }

  return ok(to);
}

/**
 * Application layer (later) may complete Order when Delivery reaches DELIVERED
 * for MERCHANT_DELIVERY / PLATFORM_DELIVERY. Domain keeps the machines separate.
 */
export function deliveryCompletionImpliesOrderReadyToComplete(
  deliveryStatus: DeliveryStatus,
): boolean {
  return deliveryStatus === "DELIVERED";
}
