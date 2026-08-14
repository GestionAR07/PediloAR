import "server-only";

import { and, eq } from "drizzle-orm";
import type {
  CompleteMerchantPickupCommand,
  CompleteMerchantPickupPersistResult,
  MerchantOrderMutationError,
} from "@/application/merchant/order-actions";
import {
  MERCHANT_ORDER_TRANSITION_ERROR_CODES,
  parseLockedOrderStatus,
} from "@/application/merchant/order-transitions";
import type { DeliveryProvider, DeliveryStatus } from "@/domain/delivery/enums";
import { canCompleteOrder } from "@/domain/order/completion";
import {
  FULFILLMENT_METHODS,
  type FulfillmentMethod,
} from "@/domain/order/enums";
import { assertOrderDeliveryCompatibility } from "@/domain/order/fulfillment-compat";
import {
  isOrderTerminalStatus,
  transitionOrderStatus,
} from "@/domain/order/transitions";
import { getDb } from "../client";
import { deliveries, orderEvents, orders } from "../schema";

class MerchantPickupCompleteTxError extends Error {
  readonly transitionError: MerchantOrderMutationError;

  constructor(error: MerchantOrderMutationError) {
    super(error.message);
    this.name = "MerchantPickupCompleteTxError";
    this.transitionError = error;
  }
}

function merchantErrorFromUnknown(
  error: unknown,
): MerchantOrderMutationError | null {
  if (error instanceof MerchantPickupCompleteTxError) {
    return error.transitionError;
  }
  if (
    error instanceof Error &&
    error.cause instanceof MerchantPickupCompleteTxError
  ) {
    return error.cause.transitionError;
  }
  return null;
}

function reject(error: MerchantOrderMutationError): never {
  throw new MerchantPickupCompleteTxError(error);
}

function parseFulfillmentMethod(value: string): FulfillmentMethod {
  if ((FULFILLMENT_METHODS as readonly string[]).includes(value)) {
    return value as FulfillmentMethod;
  }
  reject({
    code: MERCHANT_ORDER_TRANSITION_ERROR_CODES.ORDER_TRANSITION_INVALID,
    message: "No se puede actualizar el pedido.",
  });
}

/**
 * READY PICKUP → COMPLETED inside one transaction.
 * SELECT … FOR UPDATE WHERE id AND merchant_id, then Order UPDATE + one Event.
 * Does not restock, does not create Delivery, and does not use the operational core.
 */
export async function completeMerchantPickupOrderInTransaction(
  command: CompleteMerchantPickupCommand,
): Promise<CompleteMerchantPickupPersistResult> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const orderRows = await tx
        .select({
          id: orders.id,
          status: orders.status,
          fulfillmentMethod: orders.fulfillmentMethod,
        })
        .from(orders)
        .where(
          and(
            eq(orders.id, command.orderId),
            eq(orders.merchantId, command.merchantId),
          ),
        )
        .for("update")
        .limit(1);

      const order = orderRows[0];
      if (!order) {
        reject({
          code: MERCHANT_ORDER_TRANSITION_ERROR_CODES.ORDER_NOT_FOUND,
          message: "El pedido no existe.",
        });
      }

      const current = parseLockedOrderStatus(order.status);
      if (!current.ok) {
        reject(current.error);
      }

      if (current.value === "COMPLETED") {
        reject({
          code: MERCHANT_ORDER_TRANSITION_ERROR_CODES.ORDER_TRANSITION_NOOP,
          message: "El pedido ya fue procesado.",
        });
      }

      if (isOrderTerminalStatus(current.value)) {
        reject({
          code: MERCHANT_ORDER_TRANSITION_ERROR_CODES.ORDER_TRANSITION_TERMINAL,
          message: "El pedido ya no se puede actualizar.",
        });
      }

      const fulfillmentMethod = parseFulfillmentMethod(order.fulfillmentMethod);
      if (fulfillmentMethod !== "PICKUP") {
        reject({
          code: "ORDER_COMPLETE_WRONG_FULFILLMENT",
          message: "Este pedido no se puede completar como retiro.",
        });
      }

      const deliveryRows = await tx
        .select({
          status: deliveries.status,
          provider: deliveries.provider,
        })
        .from(deliveries)
        .where(eq(deliveries.orderId, order.id))
        .limit(1);
      const delivery = deliveryRows[0]
        ? {
            provider: deliveryRows[0].provider as DeliveryProvider,
            status: deliveryRows[0].status as DeliveryStatus,
          }
        : null;

      const compat = assertOrderDeliveryCompatibility(
        { fulfillmentMethod },
        delivery,
      );
      if (!compat.ok) {
        reject({
          code: compat.error.code,
          message: "No se puede completar el retiro.",
        });
      }

      const complete = canCompleteOrder({
        orderStatus: current.value,
        fulfillmentMethod,
        delivery: delivery ? { status: delivery.status } : null,
      });
      if (!complete.ok) {
        reject({
          code: complete.error.code,
          message:
            complete.error.code === "ORDER_COMPLETE_NOT_READY"
              ? "El pedido ya no se puede completar."
              : "No se puede completar el pedido.",
        });
      }

      const next = transitionOrderStatus(current.value, "COMPLETED");
      if (!next.ok) {
        reject({
          code: next.error.code,
          message: "No se puede completar el pedido.",
        });
      }

      await tx
        .update(orders)
        .set({
          status: next.value,
          updatedAt: command.now,
        })
        .where(
          and(
            eq(orders.id, order.id),
            eq(orders.merchantId, command.merchantId),
          ),
        );

      await tx.insert(orderEvents).values({
        orderId: order.id,
        fromStatus: current.value,
        toStatus: next.value,
        actorType: "MERCHANT_USER",
        actorId: command.actorUserId,
        reason: null,
      });

      return {
        status: "completed" as const,
        result: {
          orderId: order.id,
          previousStatus: current.value,
          status: "COMPLETED" as const,
        },
      };
    });
  } catch (error) {
    const mapped = merchantErrorFromUnknown(error);
    if (mapped) {
      return { status: "rejected", error: mapped };
    }
    return {
      status: "rejected",
      error: {
        code: MERCHANT_ORDER_TRANSITION_ERROR_CODES.ORDER_PERSISTENCE_FAILED,
        message: "No se pudo actualizar el pedido.",
      },
    };
  }
}
