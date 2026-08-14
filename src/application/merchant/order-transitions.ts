import { ORDER_STATUSES, type OrderStatus } from "@/domain/order/enums";
import { transitionOrderStatus } from "@/domain/order/transitions";
import { err, ok, type Result } from "@/domain/shared/result";
import { isValidUuid } from "@/lib/uuid";

export type MerchantOrderTransitionError = {
  code: string;
  message: string;
};

export const MERCHANT_OPERATIONAL_TARGETS = [
  "ACCEPTED",
  "PREPARING",
  "READY",
] as const;

export type MerchantOperationalTarget =
  (typeof MERCHANT_OPERATIONAL_TARGETS)[number];

export const MERCHANT_ORDER_TRANSITION_ERROR_CODES = {
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",
  ORDER_TRANSITION_INVALID: "ORDER_TRANSITION_INVALID",
  ORDER_TRANSITION_NOOP: "ORDER_TRANSITION_NOOP",
  ORDER_TRANSITION_TERMINAL: "ORDER_TRANSITION_TERMINAL",
  ORDER_TRANSITION_CANCEL_FORBIDDEN: "ORDER_TRANSITION_CANCEL_FORBIDDEN",
  ORDER_TRANSITION_COMPLETE_FORBIDDEN: "ORDER_TRANSITION_COMPLETE_FORBIDDEN",
  ORDER_PERSISTENCE_FAILED: "ORDER_PERSISTENCE_FAILED",
} as const;

export type TransitionMerchantOrderInput = {
  merchantId: string;
  orderId: string;
  actorUserId: string;
  targetStatus: string;
};

export type TransitionMerchantOrderCommand = {
  merchantId: string;
  orderId: string;
  actorUserId: string;
  targetStatus: MerchantOperationalTarget;
  now: Date;
};

export type MerchantOrderTransitionResult = {
  orderId: string;
  previousStatus: OrderStatus;
  status: MerchantOperationalTarget;
};

export type MerchantOrderTransitionPersistResult =
  | { status: "transitioned"; result: MerchantOrderTransitionResult }
  | { status: "rejected"; error: MerchantOrderTransitionError };

export type MerchantOrderTransitionDeps = {
  now: () => Date;
  transitionMerchantOrderInTransaction: (
    command: TransitionMerchantOrderCommand,
  ) => Promise<MerchantOrderTransitionPersistResult>;
};

/**
 * PENDING→ACCEPTED, ACCEPTED→PREPARING, PREPARING→READY.
 * CANCELED must go through cancelOrder (restock). COMPLETED needs fulfillment rules.
 */
export function assertMerchantOperationalTarget(
  target: string,
): Result<MerchantOperationalTarget, MerchantOrderTransitionError> {
  if (target === "CANCELED") {
    return err({
      code: MERCHANT_ORDER_TRANSITION_ERROR_CODES.ORDER_TRANSITION_CANCEL_FORBIDDEN,
      message: "El pedido no se puede cancelar por esta vía.",
    });
  }
  if (target === "COMPLETED") {
    return err({
      code: MERCHANT_ORDER_TRANSITION_ERROR_CODES.ORDER_TRANSITION_COMPLETE_FORBIDDEN,
      message: "El pedido no se puede completar por esta vía.",
    });
  }
  if (!(MERCHANT_OPERATIONAL_TARGETS as readonly string[]).includes(target)) {
    return err({
      code: MERCHANT_ORDER_TRANSITION_ERROR_CODES.ORDER_TRANSITION_INVALID,
      message: "No se puede actualizar el pedido.",
    });
  }
  return ok(target as MerchantOperationalTarget);
}

export function mapOrderTransitionDomainError(
  code: string,
): MerchantOrderTransitionError {
  if (code === "ORDER_TRANSITION_NOOP") {
    return {
      code: MERCHANT_ORDER_TRANSITION_ERROR_CODES.ORDER_TRANSITION_NOOP,
      message: "El pedido ya está en ese estado.",
    };
  }
  if (code === "ORDER_TRANSITION_TERMINAL") {
    return {
      code: MERCHANT_ORDER_TRANSITION_ERROR_CODES.ORDER_TRANSITION_TERMINAL,
      message: "El pedido ya no se puede actualizar.",
    };
  }
  return {
    code: MERCHANT_ORDER_TRANSITION_ERROR_CODES.ORDER_TRANSITION_INVALID,
    message: "No se puede actualizar el pedido.",
  };
}

export function parseLockedOrderStatus(
  status: string,
): Result<OrderStatus, MerchantOrderTransitionError> {
  if (ORDER_STATUSES.includes(status as OrderStatus)) {
    return ok(status as OrderStatus);
  }
  return err({
    code: MERCHANT_ORDER_TRANSITION_ERROR_CODES.ORDER_TRANSITION_INVALID,
    message: "No se puede actualizar el pedido.",
  });
}

export function decideMerchantOperationalTransition(
  currentStatus: OrderStatus,
  targetStatus: MerchantOperationalTarget,
): Result<MerchantOperationalTarget, MerchantOrderTransitionError> {
  const transition = transitionOrderStatus(currentStatus, targetStatus);
  if (!transition.ok) {
    return err(mapOrderTransitionDomainError(transition.error.code));
  }
  return ok(targetStatus);
}

function notFound(): MerchantOrderTransitionError {
  return {
    code: MERCHANT_ORDER_TRANSITION_ERROR_CODES.ORDER_NOT_FOUND,
    message: "El pedido no existe.",
  };
}

/**
 * Internal merchant operational advance. Caller must already be an authorized
 * MERCHANT_USER (OWNER/STAFF). Current status is loaded under lock on the server.
 */
export async function transitionMerchantOperationalOrder(
  input: TransitionMerchantOrderInput,
  deps: MerchantOrderTransitionDeps,
): Promise<
  Result<MerchantOrderTransitionResult, MerchantOrderTransitionError>
> {
  if (!isValidUuid(input.merchantId) || !isValidUuid(input.orderId)) {
    return err(notFound());
  }
  if (!isValidUuid(input.actorUserId)) {
    return err({
      code: MERCHANT_ORDER_TRANSITION_ERROR_CODES.ORDER_TRANSITION_INVALID,
      message: "No se puede actualizar el pedido.",
    });
  }

  const target = assertMerchantOperationalTarget(input.targetStatus);
  if (!target.ok) {
    return err(target.error);
  }

  const persisted = await deps.transitionMerchantOrderInTransaction({
    merchantId: input.merchantId,
    orderId: input.orderId,
    actorUserId: input.actorUserId,
    targetStatus: target.value,
    now: deps.now(),
  });

  if (persisted.status === "transitioned") {
    return ok(persisted.result);
  }
  return err(persisted.error);
}
