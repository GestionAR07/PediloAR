import "server-only";

import { and, eq } from "drizzle-orm";
import {
  assertMerchantOperationalTarget,
  decideMerchantOperationalTransition,
  parseLockedOrderStatus,
  type MerchantOrderTransitionError,
  type MerchantOrderTransitionPersistResult,
  type TransitionMerchantOrderCommand,
} from "@/application/merchant/order-transitions";
import { getDb } from "../client";
import { orderEvents, orders } from "../schema";

class MerchantTransitionTxError extends Error {
  readonly transitionError: MerchantOrderTransitionError;

  constructor(error: MerchantOrderTransitionError) {
    super(error.message);
    this.name = "MerchantTransitionTxError";
    this.transitionError = error;
  }
}

function merchantErrorFromUnknown(
  error: unknown,
): MerchantOrderTransitionError | null {
  if (error instanceof MerchantTransitionTxError) {
    return error.transitionError;
  }
  if (
    error instanceof Error &&
    error.cause instanceof MerchantTransitionTxError
  ) {
    return error.cause.transitionError;
  }
  return null;
}

function reject(error: MerchantOrderTransitionError): never {
  throw new MerchantTransitionTxError(error);
}

/**
 * Merchant-scoped operational advance inside one transaction.
 * SELECT … FOR UPDATE WHERE id AND merchant_id, then Order UPDATE + one Event.
 * Does not restock and does not write Delivery.
 * Cancellation and completion stay on specialized operations.
 */
export async function transitionMerchantOrderInTransaction(
  command: TransitionMerchantOrderCommand,
): Promise<MerchantOrderTransitionPersistResult> {
  const targetGuard = assertMerchantOperationalTarget(command.targetStatus);
  if (!targetGuard.ok) {
    return { status: "rejected", error: targetGuard.error };
  }

  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const orderRows = await tx
        .select({
          id: orders.id,
          status: orders.status,
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
          code: "ORDER_NOT_FOUND",
          message: "El pedido no existe.",
        });
      }

      const current = parseLockedOrderStatus(order.status);
      if (!current.ok) {
        reject(current.error);
      }

      const next = decideMerchantOperationalTransition(
        current.value,
        targetGuard.value,
      );
      if (!next.ok) {
        reject(next.error);
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
        status: "transitioned" as const,
        result: {
          orderId: order.id,
          previousStatus: current.value,
          status: next.value,
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
        code: "ORDER_PERSISTENCE_FAILED",
        message: "No se pudo actualizar el pedido.",
      },
    };
  }
}
