import { cancelOrder } from "@/application/checkout/cancel-order";
import type {
  CancelOrderCommand,
  CancelOrderPersistResult,
} from "@/application/checkout/types";
import { CHECKOUT_ERROR_CODES } from "@/application/checkout/errors";
import { MERCHANT_ORDER_ALLOWED_ROLES } from "@/application/merchant/order-inbox";
import {
  MERCHANT_ORDER_TRANSITION_ERROR_CODES,
  transitionMerchantOperationalOrder,
  type MerchantOrderTransitionDeps,
  type MerchantOrderTransitionError,
  type MerchantOrderTransitionResult,
} from "@/application/merchant/order-transitions";
import { err, ok, type Result } from "@/domain/shared/result";
import { isValidUuid } from "@/lib/uuid";

export { MERCHANT_ORDER_ALLOWED_ROLES };

export const MERCHANT_REJECT_REASONS = [
  "MERCHANT_UNAVAILABLE",
  "OUT_OF_STOCK",
  "OTHER",
] as const;

export type MerchantRejectReason = (typeof MERCHANT_REJECT_REASONS)[number];

export type MerchantOrderMutationError = MerchantOrderTransitionError;

export type AcceptMerchantOrderInput = {
  merchantId: string;
  orderId: string;
  actorUserId: string;
};

export type RejectMerchantOrderInput = {
  merchantId: string;
  orderId: string;
  actorUserId: string;
  reason: string;
};

export type RejectMerchantOrderResult = {
  orderId: string;
  previousStatus: string;
  status: "CANCELED";
  restoredTrackedQuantity: number;
};

export type MerchantOrderActionDeps = MerchantOrderTransitionDeps & {
  requireMerchantOrderAccess: (merchantId: string) => Promise<void>;
  cancelOrderInTransaction: (
    command: CancelOrderCommand,
  ) => Promise<CancelOrderPersistResult>;
};

function notFound(): MerchantOrderMutationError {
  return {
    code: MERCHANT_ORDER_TRANSITION_ERROR_CODES.ORDER_NOT_FOUND,
    message: "El pedido no existe.",
  };
}

export function isMerchantRejectReason(
  value: string,
): value is MerchantRejectReason {
  return (MERCHANT_REJECT_REASONS as readonly string[]).includes(value);
}

function mapCancelError(
  code: string,
  message: string,
): MerchantOrderMutationError {
  if (code === CHECKOUT_ERROR_CODES.ORDER_NOT_FOUND) {
    return notFound();
  }
  if (code === CHECKOUT_ERROR_CODES.ORDER_ALREADY_CANCELED) {
    return {
      code: CHECKOUT_ERROR_CODES.ORDER_ALREADY_CANCELED,
      message: "El pedido ya fue procesado.",
    };
  }
  if (code === CHECKOUT_ERROR_CODES.INVALID_CANCEL_REASON) {
    return {
      code: CHECKOUT_ERROR_CODES.INVALID_CANCEL_REASON,
      message: "El motivo de rechazo no es válido.",
    };
  }
  if (code === CHECKOUT_ERROR_CODES.ORDER_NOT_CANCELABLE) {
    return {
      code: CHECKOUT_ERROR_CODES.ORDER_NOT_CANCELABLE,
      message: "El pedido ya no se puede rechazar.",
    };
  }
  return {
    code,
    message: message || "No se pudo rechazar el pedido.",
  };
}

/**
 * PENDING → ACCEPTED. Target is fixed server-side.
 */
export async function acceptMerchantOrder(
  input: AcceptMerchantOrderInput,
  deps: MerchantOrderActionDeps,
): Promise<Result<MerchantOrderTransitionResult, MerchantOrderMutationError>> {
  await deps.requireMerchantOrderAccess(input.merchantId);
  const result = await transitionMerchantOperationalOrder(
    {
      merchantId: input.merchantId,
      orderId: input.orderId,
      actorUserId: input.actorUserId,
      targetStatus: "ACCEPTED",
    },
    deps,
  );
  if (!result.ok && result.error.code === "ORDER_TRANSITION_NOOP") {
    return err({
      code: result.error.code,
      message: "El pedido ya fue procesado.",
    });
  }
  return result;
}

/**
 * PENDING → CANCELED via cancelOrder (restock). Not a generic in-progress cancel.
 */
export async function rejectMerchantOrder(
  input: RejectMerchantOrderInput,
  deps: MerchantOrderActionDeps,
): Promise<Result<RejectMerchantOrderResult, MerchantOrderMutationError>> {
  await deps.requireMerchantOrderAccess(input.merchantId);
  if (!isValidUuid(input.merchantId) || !isValidUuid(input.orderId)) {
    return err(notFound());
  }
  if (!isValidUuid(input.actorUserId)) {
    return err({
      code: MERCHANT_ORDER_TRANSITION_ERROR_CODES.ORDER_TRANSITION_INVALID,
      message: "No se puede actualizar el pedido.",
    });
  }
  if (!isMerchantRejectReason(input.reason)) {
    return err({
      code: CHECKOUT_ERROR_CODES.INVALID_CANCEL_REASON,
      message: "El motivo de rechazo no es válido.",
    });
  }

  const canceled = await cancelOrder(
    {
      orderId: input.orderId,
      actor: { type: "MERCHANT_USER", id: input.actorUserId },
      reason: input.reason,
      expectedMerchantId: input.merchantId,
      expectedCurrentStatus: "PENDING",
    },
    {
      now: deps.now,
      cancelOrderInTransaction: deps.cancelOrderInTransaction,
    },
  );

  if (!canceled.ok) {
    return err(mapCancelError(canceled.error.code, canceled.error.message));
  }
  return ok({
    orderId: canceled.value.orderId,
    previousStatus: canceled.value.previousStatus,
    status: "CANCELED",
    restoredTrackedQuantity: canceled.value.restoredTrackedQuantity,
  });
}
