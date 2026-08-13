import { parseCancelReason } from "@/domain/order/cancellation";
import { ORDER_ACTOR_TYPES, type OrderActorType } from "@/domain/order/enums";
import { err, ok, type Result } from "@/domain/shared/result";
import { isValidUuid } from "@/lib/uuid";
import {
  checkoutError,
  CHECKOUT_ERROR_CODES,
  type CheckoutApplicationError,
} from "./errors";
import type {
  CancelOrderCommand,
  CancelOrderInput,
  CancelOrderPersistResult,
  CanceledOrderResult,
} from "./types";

export type CancelOrderDeps = {
  now: () => Date;
  cancelOrderInTransaction: (
    command: CancelOrderCommand,
  ) => Promise<CancelOrderPersistResult>;
};

function fail(
  code: (typeof CHECKOUT_ERROR_CODES)[keyof typeof CHECKOUT_ERROR_CODES],
  message: string,
): Result<CanceledOrderResult, CheckoutApplicationError> {
  return err(checkoutError(code, message));
}

/**
 * Authoritative order cancellation with exactly-once TRACKED restock.
 * Actor is application-level — not a public browser contract.
 */
export async function cancelOrder(
  input: CancelOrderInput,
  deps: CancelOrderDeps,
): Promise<Result<CanceledOrderResult, CheckoutApplicationError>> {
  if (!isValidUuid(input.orderId ?? "")) {
    return fail(CHECKOUT_ERROR_CODES.ORDER_NOT_FOUND, "El pedido no existe.");
  }

  const actorType = String(input.actor?.type ?? "");
  if (
    !ORDER_ACTOR_TYPES.includes(actorType as (typeof ORDER_ACTOR_TYPES)[number])
  ) {
    return fail(
      CHECKOUT_ERROR_CODES.ORDER_NOT_CANCELABLE,
      "No se puede cancelar el pedido.",
    );
  }

  const reasonResult = parseCancelReason(input.reason ?? "");
  if (!reasonResult.ok) {
    return fail(
      CHECKOUT_ERROR_CODES.INVALID_CANCEL_REASON,
      "El motivo de cancelación no es válido.",
    );
  }

  const actorId = input.actor?.id?.trim() ? input.actor.id.trim() : null;

  const persisted = await deps.cancelOrderInTransaction({
    orderId: input.orderId,
    actorType: actorType as OrderActorType,
    actorId,
    reason: reasonResult.value,
    now: deps.now(),
  });

  if (persisted.status === "canceled") {
    return ok(persisted.result);
  }
  if (persisted.status === "already_canceled") {
    return fail(
      CHECKOUT_ERROR_CODES.ORDER_ALREADY_CANCELED,
      "El pedido ya está cancelado.",
    );
  }
  return err(persisted.error);
}
