import "server-only";

import { and, eq } from "drizzle-orm";
import type {
  CompleteMerchantDeliveryCommand,
  CompleteMerchantDeliveryPersistResult,
  MerchantOrderMutationError,
  StartMerchantDeliveryCommand,
  StartMerchantDeliveryPersistResult,
} from "@/application/merchant/order-actions";
import {
  MERCHANT_ORDER_TRANSITION_ERROR_CODES,
  parseLockedOrderStatus,
} from "@/application/merchant/order-transitions";
import {
  DELIVERY_PROVIDERS,
  DELIVERY_STATUSES,
  type DeliveryProvider,
  type DeliveryStatus,
} from "@/domain/delivery/enums";
import {
  deliveryCompletionImpliesOrderReadyToComplete,
  transitionDeliveryStatus,
} from "@/domain/delivery/transitions";
import { canCompleteOrder } from "@/domain/order/completion";
import {
  FULFILLMENT_METHODS,
  type FulfillmentMethod,
  type OrderStatus,
} from "@/domain/order/enums";
import { assertOrderDeliveryCompatibility } from "@/domain/order/fulfillment-compat";
import {
  assertFulfillmentAllowedForMvp,
  isOrderTerminalStatus,
  transitionOrderStatus,
} from "@/domain/order/transitions";
import { getDb, type Db } from "../client";
import { deliveries, orderEvents, orders } from "../schema";

class MerchantDeliveryTxError extends Error {
  readonly transitionError: MerchantOrderMutationError;

  constructor(error: MerchantOrderMutationError) {
    super(error.message);
    this.name = "MerchantDeliveryTxError";
    this.transitionError = error;
  }
}

function merchantErrorFromUnknown(
  error: unknown,
): MerchantOrderMutationError | null {
  if (error instanceof MerchantDeliveryTxError) {
    return error.transitionError;
  }
  if (
    error instanceof Error &&
    error.cause instanceof MerchantDeliveryTxError
  ) {
    return error.cause.transitionError;
  }
  return null;
}

function reject(error: MerchantOrderMutationError): never {
  throw new MerchantDeliveryTxError(error);
}

function persistenceFailed(): MerchantOrderMutationError {
  return {
    code: MERCHANT_ORDER_TRANSITION_ERROR_CODES.ORDER_PERSISTENCE_FAILED,
    message: "No se pudo actualizar el pedido.",
  };
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

function parseDeliveryProvider(value: string): DeliveryProvider {
  if ((DELIVERY_PROVIDERS as readonly string[]).includes(value)) {
    return value as DeliveryProvider;
  }
  reject({
    code: "DELIVERY_TRANSITION_INVALID",
    message: "No se puede actualizar el envío.",
  });
}

function parseDeliveryStatus(value: string): DeliveryStatus {
  if ((DELIVERY_STATUSES as readonly string[]).includes(value)) {
    return value as DeliveryStatus;
  }
  reject({
    code: "DELIVERY_TRANSITION_INVALID",
    message: "No se puede actualizar el envío.",
  });
}

function mapDeliveryTransitionError(code: string): MerchantOrderMutationError {
  if (code === "DELIVERY_TRANSITION_NOOP") {
    return {
      code,
      message: "El pedido ya fue procesado.",
    };
  }
  if (code === "DELIVERY_TRANSITION_TERMINAL") {
    return {
      code,
      message: "El envío ya no se puede actualizar.",
    };
  }
  return {
    code: "DELIVERY_TRANSITION_INVALID",
    message: "No se puede actualizar el envío.",
  };
}

type MerchantDbTx = Parameters<Parameters<Db["transaction"]>[0]>[0];

type LockedMerchantDeliveryOrder = {
  orderId: string;
  merchantId: string;
  orderStatus: OrderStatus;
  fulfillmentMethod: FulfillmentMethod;
  delivery: {
    id: string;
    provider: DeliveryProvider;
    status: DeliveryStatus;
  };
};

async function lockMerchantDeliveryOrder(
  tx: MerchantDbTx,
  command: { merchantId: string; orderId: string },
): Promise<LockedMerchantDeliveryOrder> {
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
  const mvp = assertFulfillmentAllowedForMvp(fulfillmentMethod);
  if (!mvp.ok) {
    reject({
      code: mvp.error.code,
      message: "Este pedido no se puede gestionar como envío del comercio.",
    });
  }

  if (fulfillmentMethod !== "MERCHANT_DELIVERY") {
    reject({
      code: "ORDER_COMPLETE_WRONG_FULFILLMENT",
      message: "Este pedido no se envía a domicilio.",
    });
  }

  const deliveryRows = await tx
    .select({
      id: deliveries.id,
      provider: deliveries.provider,
      status: deliveries.status,
    })
    .from(deliveries)
    .where(eq(deliveries.orderId, order.id))
    .for("update")
    .limit(1);

  const deliveryRow = deliveryRows[0];
  if (!deliveryRow) {
    reject({
      code: "DELIVERY_NOT_FOUND",
      message: "No se encontró el envío.",
    });
  }

  const provider = parseDeliveryProvider(deliveryRow.provider);
  const deliveryStatus = parseDeliveryStatus(deliveryRow.status);

  if (provider !== "MERCHANT") {
    reject({
      code: "DELIVERY_PROVIDER_INVALID",
      message: "Este pedido no se puede gestionar como envío del comercio.",
    });
  }

  const compat = assertOrderDeliveryCompatibility(
    { fulfillmentMethod },
    { provider },
  );
  if (!compat.ok) {
    reject({
      code: compat.error.code,
      message: "No se puede actualizar el envío.",
    });
  }

  return {
    orderId: order.id,
    merchantId: command.merchantId,
    orderStatus: current.value,
    fulfillmentMethod,
    delivery: {
      id: deliveryRow.id,
      provider,
      status: deliveryStatus,
    },
  };
}

/**
 * READY + MERCHANT Delivery PENDING → IN_TRANSIT.
 * Does not change Order status, does not write OrderEvent, does not touch stock.
 */
export async function startMerchantDeliveryInTransaction(
  command: StartMerchantDeliveryCommand,
): Promise<StartMerchantDeliveryPersistResult> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const locked = await lockMerchantDeliveryOrder(tx, command);

      if (locked.orderStatus !== "READY") {
        reject({
          code: MERCHANT_ORDER_TRANSITION_ERROR_CODES.ORDER_TRANSITION_INVALID,
          message: "El pedido no está listo para el envío.",
        });
      }

      const nextDelivery = transitionDeliveryStatus(
        locked.delivery.provider,
        locked.delivery.status,
        "IN_TRANSIT",
      );
      if (!nextDelivery.ok) {
        reject(mapDeliveryTransitionError(nextDelivery.error.code));
      }

      await tx
        .update(deliveries)
        .set({
          status: nextDelivery.value,
          updatedAt: command.now,
        })
        .where(eq(deliveries.id, locked.delivery.id));

      return {
        status: "started" as const,
        result: {
          orderId: locked.orderId,
          orderStatus: "READY" as const,
          previousDeliveryStatus: "PENDING" as const,
          deliveryStatus: "IN_TRANSIT" as const,
        },
      };
    });
  } catch (error) {
    const mapped = merchantErrorFromUnknown(error);
    if (mapped) {
      return { status: "rejected", error: mapped };
    }
    return { status: "rejected", error: persistenceFailed() };
  }
}

/**
 * READY + MERCHANT Delivery IN_TRANSIT → Delivery DELIVERED + Order COMPLETED + 1 event.
 * One transaction. Does not restock. Does not use the pickup completion path.
 */
export async function completeMerchantDeliveryInTransaction(
  command: CompleteMerchantDeliveryCommand,
): Promise<CompleteMerchantDeliveryPersistResult> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const locked = await lockMerchantDeliveryOrder(tx, command);

      if (locked.orderStatus !== "READY") {
        reject({
          code: "ORDER_COMPLETE_NOT_READY",
          message: "El pedido ya no se puede completar.",
        });
      }

      const nextDelivery = transitionDeliveryStatus(
        locked.delivery.provider,
        locked.delivery.status,
        "DELIVERED",
      );
      if (!nextDelivery.ok) {
        if (
          locked.delivery.status === "PENDING" &&
          nextDelivery.error.code === "DELIVERY_TRANSITION_INVALID"
        ) {
          reject({
            code: "DELIVERY_TRANSITION_INVALID",
            message: "El envío aún no está en camino.",
          });
        }
        reject(mapDeliveryTransitionError(nextDelivery.error.code));
      }

      if (!deliveryCompletionImpliesOrderReadyToComplete(nextDelivery.value)) {
        reject({
          code: "ORDER_COMPLETE_DELIVERY_NOT_DELIVERED",
          message: "No se puede completar el pedido.",
        });
      }

      const complete = canCompleteOrder({
        orderStatus: locked.orderStatus,
        fulfillmentMethod: locked.fulfillmentMethod,
        delivery: { status: nextDelivery.value },
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

      const nextOrder = transitionOrderStatus(locked.orderStatus, "COMPLETED");
      if (!nextOrder.ok) {
        reject({
          code: nextOrder.error.code,
          message: "No se puede completar el pedido.",
        });
      }

      await tx
        .update(deliveries)
        .set({
          status: nextDelivery.value,
          updatedAt: command.now,
        })
        .where(eq(deliveries.id, locked.delivery.id));

      await tx
        .update(orders)
        .set({
          status: nextOrder.value,
          updatedAt: command.now,
        })
        .where(
          and(
            eq(orders.id, locked.orderId),
            eq(orders.merchantId, locked.merchantId),
          ),
        );

      await tx.insert(orderEvents).values({
        orderId: locked.orderId,
        fromStatus: locked.orderStatus,
        toStatus: nextOrder.value,
        actorType: "MERCHANT_USER",
        actorId: command.actorUserId,
        reason: null,
      });

      return {
        status: "completed" as const,
        result: {
          orderId: locked.orderId,
          previousStatus: locked.orderStatus,
          status: "COMPLETED" as const,
          previousDeliveryStatus: "IN_TRANSIT" as const,
          deliveryStatus: "DELIVERED" as const,
        },
      };
    });
  } catch (error) {
    const mapped = merchantErrorFromUnknown(error);
    if (mapped) {
      return { status: "rejected", error: mapped };
    }
    return { status: "rejected", error: persistenceFailed() };
  }
}
