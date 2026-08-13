import { moneyCents } from "@/domain/money/money-cents";
import { parseIdempotencyKey } from "@/domain/order/idempotency";
import type { FulfillmentMethod } from "@/domain/order/enums";
import { err, ok, type Result } from "@/domain/shared/result";
import {
  checkoutError,
  CHECKOUT_ERROR_CODES,
  type CheckoutApplicationError,
} from "./errors";
import {
  canonicalIntentFromPersisted,
  canonicalIntentFromRequest,
} from "./intent-fingerprint";
import { prepareOrder } from "./prepare-order";
import { buildQuoteFingerprint, toCheckoutReview } from "./checkout-review";
import type {
  PersistedCheckoutOrder,
  PersistPreparedOrderResult,
  PlacedOrderResult,
  PreparedOrder,
  PrepareOrderDeps,
  PrepareOrderInput,
} from "./types";

export type PlaceOrderDeps = PrepareOrderDeps & {
  findOrderByIdempotencyKey: (
    key: string,
  ) => Promise<PersistedCheckoutOrder | null>;
  persistPreparedOrder: (
    prepared: PreparedOrder,
  ) => Promise<PersistPreparedOrderResult>;
};

function fail(
  code: (typeof CHECKOUT_ERROR_CODES)[keyof typeof CHECKOUT_ERROR_CODES],
  message: string,
  review?: ReturnType<typeof toCheckoutReview>,
): Result<PlacedOrderResult, CheckoutApplicationError> {
  return err(checkoutError(code, message, review));
}

function replayOrConflict(
  existing: PersistedCheckoutOrder,
  input: PrepareOrderInput,
): Result<PlacedOrderResult, CheckoutApplicationError> {
  const requestIntent = canonicalIntentFromRequest(input);
  const persistedIntent = canonicalIntentFromPersisted(existing);
  if (!requestIntent.ok || requestIntent.value !== persistedIntent) {
    return fail(
      CHECKOUT_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      "Ya existe un pedido con esta clave de idempotencia y otra intención.",
    );
  }

  return ok({
    orderId: existing.orderId,
    status: "PENDING",
    merchantId: existing.merchantId,
    totalCents: moneyCents(existing.totalCents),
    fulfillmentMethod: existing.fulfillmentMethod as FulfillmentMethod,
    replayed: true,
  });
}

/**
 * Idempotency-first order placement.
 *
 * Lookup by idempotency_key happens BEFORE prepareOrder so a lost-response
 * retry does not fail after the first attempt already decremented stock.
 *
 * TRACKED stock is decremented when the PENDING order is created.
 * Cancel restores TRACKED stock exactly once (see cancelOrder).
 */
export async function placeOrder(
  input: PrepareOrderInput,
  deps: PlaceOrderDeps,
): Promise<Result<PlacedOrderResult, CheckoutApplicationError>> {
  const keyResult = parseIdempotencyKey(input.idempotencyKey ?? "");
  if (!keyResult.ok) {
    return fail(
      CHECKOUT_ERROR_CODES.IDEMPOTENCY_KEY_INVALID,
      "La clave de idempotencia no es válida.",
    );
  }

  const existing = await deps.findOrderByIdempotencyKey(keyResult.value);
  if (existing) {
    return replayOrConflict(existing, input);
  }

  const prepared = await prepareOrder(input, deps);
  if (!prepared.ok) {
    return prepared;
  }

  const expected = input.expectedQuoteFingerprint?.trim() ?? "";
  if (expected) {
    const current = buildQuoteFingerprint(prepared.value);
    if (current !== expected) {
      return fail(
        CHECKOUT_ERROR_CODES.CHECKOUT_REVIEW_REQUIRED,
        "El pedido cambió desde la última revisión. Revisá los datos actualizados antes de confirmar.",
        toCheckoutReview(prepared.value),
      );
    }
  }

  const persisted = await deps.persistPreparedOrder(prepared.value);
  if (persisted.status === "created") {
    return ok({
      ...persisted.order,
      replayed: false,
    });
  }
  if (persisted.status === "rejected") {
    return err(persisted.error);
  }

  const winner = await deps.findOrderByIdempotencyKey(keyResult.value);
  if (!winner) {
    return fail(
      CHECKOUT_ERROR_CODES.ORDER_PERSISTENCE_FAILED,
      "No se pudo confirmar el pedido.",
    );
  }
  return replayOrConflict(winner, input);
}
