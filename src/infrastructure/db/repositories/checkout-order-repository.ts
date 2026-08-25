import "server-only";

import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  checkoutError,
  CHECKOUT_ERROR_CODES,
  type CheckoutApplicationError,
} from "@/application/checkout/errors";
import type {
  CancelOrderCommand,
  CancelOrderPersistResult,
  PersistedCheckoutOrder,
  PersistPreparedOrderResult,
  PreparedOrder,
} from "@/application/checkout/types";
import { isMerchantOperationallyAcceptingOrders } from "@/domain/merchant/operational-availability";
import { moneyCents } from "@/domain/money/money-cents";
import { canCancelOrder } from "@/domain/order/cancellation";
import type { OrderStatus } from "@/domain/order/enums";
import { assertOrderDeliveryCompatibility } from "@/domain/order/fulfillment-compat";
import { transitionOrderStatus } from "@/domain/order/transitions";
import {
  transitionDeliveryStatus,
  isDeliveryTerminalStatus,
} from "@/domain/delivery/transitions";
import type { DeliveryProvider, DeliveryStatus } from "@/domain/delivery/enums";
import { isUniqueViolation } from "../pg-errors";
import { getDb } from "../client";
import {
  deliveries,
  merchants,
  orderEvents,
  orderItemOptions,
  orderItems,
  orders,
  products,
} from "../schema";

class CheckoutTxError extends Error {
  readonly checkoutError: CheckoutApplicationError;

  constructor(error: CheckoutApplicationError) {
    super(error.message);
    this.name = "CheckoutTxError";
    this.checkoutError = error;
  }
}

function checkoutErrorFromUnknown(
  error: unknown,
): CheckoutApplicationError | null {
  if (error instanceof CheckoutTxError) {
    return error.checkoutError;
  }
  if (error instanceof Error && error.cause instanceof CheckoutTxError) {
    return error.cause.checkoutError;
  }
  return null;
}

function reject(
  code: (typeof CHECKOUT_ERROR_CODES)[keyof typeof CHECKOUT_ERROR_CODES],
  message: string,
): never {
  throw new CheckoutTxError(checkoutError(code, message));
}

export async function findOrderByIdempotencyKey(
  key: string,
): Promise<PersistedCheckoutOrder | null> {
  const db = getDb();
  const orderRows = await db
    .select({
      orderId: orders.id,
      status: orders.status,
      merchantId: orders.merchantId,
      customerUserId: orders.customerUserId,
      totalCents: orders.totalCents,
      fulfillmentMethod: orders.fulfillmentMethod,
      customerNameSnapshot: orders.customerNameSnapshot,
      customerPhoneSnapshot: orders.customerPhoneSnapshot,
      paymentMethodCode: orders.paymentMethodCode,
      deliveryZoneId: orders.deliveryZoneId,
      deliveryStreet: orders.deliveryStreet,
      deliveryNumber: orders.deliveryNumber,
      deliveryFloorApartment: orders.deliveryFloorApartment,
      deliveryReference: orders.deliveryReference,
    })
    .from(orders)
    .where(eq(orders.idempotencyKey, key))
    .limit(1);

  const order = orderRows[0];
  if (!order) {
    return null;
  }

  const itemRows = await db
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.orderId));

  const itemIds = itemRows.map((item) => item.id);
  const optionRows =
    itemIds.length === 0
      ? []
      : await db
          .select({
            orderItemId: orderItemOptions.orderItemId,
            optionGroupId: orderItemOptions.optionGroupId,
            optionChoiceId: orderItemOptions.optionChoiceId,
            quantity: orderItemOptions.quantity,
          })
          .from(orderItemOptions)
          .where(inArray(orderItemOptions.orderItemId, itemIds));

  const optionsByItem = new Map<string, typeof optionRows>();
  for (const option of optionRows) {
    const list = optionsByItem.get(option.orderItemId) ?? [];
    list.push(option);
    optionsByItem.set(option.orderItemId, list);
  }

  return {
    orderId: order.orderId,
    status: order.status,
    merchantId: order.merchantId,
    totalCents: Number(order.totalCents),
    fulfillmentMethod: order.fulfillmentMethod,
    customerNameSnapshot: order.customerNameSnapshot,
    customerPhoneSnapshot: order.customerPhoneSnapshot,
    paymentMethodCode: order.paymentMethodCode,
    deliveryZoneId: order.deliveryZoneId,
    deliveryStreet: order.deliveryStreet,
    deliveryNumber: order.deliveryNumber,
    deliveryFloorApartment: order.deliveryFloorApartment,
    deliveryReference: order.deliveryReference,
    lines: itemRows.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      options: (optionsByItem.get(item.id) ?? []).map((option) => ({
        optionGroupId: option.optionGroupId,
        optionChoiceId: option.optionChoiceId,
        quantity: option.quantity,
      })),
    })),
  };
}

function trackedDemand(prepared: PreparedOrder): Map<string, number> {
  const demand = new Map<string, number>();
  for (const line of prepared.lines) {
    demand.set(
      line.productId,
      (demand.get(line.productId) ?? 0) + line.quantity,
    );
  }
  return demand;
}

/**
 * Writes a new Order inside one Postgres transaction.
 * Unique idempotency races roll back automatically and surface as unique_violation.
 *
 * Products are locked FOR UPDATE (stable id order) so stock_mode/delete
 * cannot race past a TRACKED decrement.
 */
export async function persistPreparedOrderInTransaction(
  prepared: PreparedOrder,
  now: Date,
): Promise<PersistPreparedOrderResult> {
  const db = getDb();

  try {
    const created = await db.transaction(async (tx) => {
      const merchantRows = await tx
        .select({
          id: merchants.id,
          status: merchants.status,
          acceptingOrders: merchants.acceptingOrders,
          pausedUntil: merchants.pausedUntil,
        })
        .from(merchants)
        .where(eq(merchants.id, prepared.merchantId))
        .for("update")
        .limit(1);

      const merchant = merchantRows[0];
      if (
        !merchant ||
        !isMerchantOperationallyAcceptingOrders(
          {
            status: merchant.status as "DRAFT" | "ACTIVE" | "SUSPENDED",
            acceptingOrders: merchant.acceptingOrders,
            pausedUntil: merchant.pausedUntil,
          },
          now,
        )
      ) {
        reject(
          CHECKOUT_ERROR_CODES.MERCHANT_NOT_ACCEPTING,
          "El comercio no está tomando pedidos.",
        );
      }

      const productIds = [
        ...new Set(prepared.lines.map((line) => line.productId)),
      ];
      const productRows = await tx
        .select({
          id: products.id,
          merchantId: products.merchantId,
          active: products.active,
          available: products.available,
          stockMode: products.stockMode,
          stockQuantity: products.stockQuantity,
        })
        .from(products)
        .where(
          and(
            inArray(products.id, productIds),
            eq(products.merchantId, prepared.merchantId),
          ),
        )
        .orderBy(asc(products.id))
        .for("update");

      const productById = new Map(productRows.map((row) => [row.id, row]));
      for (const productId of productIds) {
        const product = productById.get(productId);
        if (
          !product ||
          product.merchantId !== prepared.merchantId ||
          !product.active ||
          !product.available
        ) {
          reject(
            CHECKOUT_ERROR_CODES.PRODUCT_NOT_SELLABLE,
            "Un producto no está disponible para la venta.",
          );
        }
      }

      const insertedOrders = await tx
        .insert(orders)
        .values({
          merchantId: prepared.merchantId,
          customerUserId: prepared.customerUserId,
          customerNameSnapshot: prepared.customerNameSnapshot,
          customerPhoneSnapshot: prepared.customerPhoneSnapshot,
          merchantNameSnapshot: prepared.merchantNameSnapshot,
          status: "PENDING",
          fulfillmentMethod: prepared.fulfillmentMethod,
          idempotencyKey: prepared.idempotencyKey,
          itemSubtotalCents: prepared.itemSubtotalCents,
          optionsSubtotalCents: prepared.optionsSubtotalCents,
          orderSubtotalCents: prepared.orderSubtotalCents,
          deliveryFeeCents: prepared.deliveryFeeCents,
          totalCents: prepared.totalCents,
          paymentMethodCode: prepared.paymentMethodSnapshot.code,
          paymentMethodLabel: prepared.paymentMethodSnapshot.label,
          paymentMethodInstructions:
            prepared.paymentMethodSnapshot.instructions,
          deliveryCityId:
            prepared.fulfillmentMethod === "PICKUP"
              ? null
              : (prepared.delivery?.cityId ?? null),
          deliveryZoneId:
            prepared.fulfillmentMethod === "PICKUP"
              ? null
              : (prepared.delivery?.zoneId ?? null),
          deliveryCityNameSnapshot:
            prepared.fulfillmentMethod === "PICKUP"
              ? null
              : (prepared.delivery?.cityNameSnapshot ?? null),
          deliveryZoneNameSnapshot:
            prepared.fulfillmentMethod === "PICKUP"
              ? null
              : (prepared.delivery?.zoneNameSnapshot ?? null),
          deliveryStreet:
            prepared.fulfillmentMethod === "PICKUP"
              ? null
              : (prepared.delivery?.street ?? null),
          deliveryNumber:
            prepared.fulfillmentMethod === "PICKUP"
              ? null
              : (prepared.delivery?.number ?? null),
          deliveryFloorApartment:
            prepared.fulfillmentMethod === "PICKUP"
              ? null
              : (prepared.delivery?.floorApartment ?? null),
          deliveryReference:
            prepared.fulfillmentMethod === "PICKUP"
              ? null
              : (prepared.delivery?.reference ?? null),
        })
        .returning({ id: orders.id });

      const orderId = insertedOrders[0]?.id;
      if (!orderId) {
        reject(
          CHECKOUT_ERROR_CODES.ORDER_PERSISTENCE_FAILED,
          "No se pudo crear el pedido.",
        );
      }

      for (const [productId, quantity] of trackedDemand(prepared)) {
        const product = productById.get(productId)!;
        if (product.stockMode !== "TRACKED") {
          continue;
        }

        const updated = await tx
          .update(products)
          .set({
            stockQuantity: sql`${products.stockQuantity} - ${quantity}`,
            updatedAt: now,
          })
          .where(
            and(
              eq(products.id, productId),
              eq(products.merchantId, prepared.merchantId),
              eq(products.active, true),
              eq(products.available, true),
              eq(products.stockMode, "TRACKED"),
              gte(products.stockQuantity, quantity),
            ),
          )
          .returning({ id: products.id });

        if (updated.length === 0) {
          const live = productById.get(productId);
          const stock = live?.stockQuantity ?? 0;
          if (live?.stockMode === "TRACKED" && stock < quantity) {
            reject(
              CHECKOUT_ERROR_CODES.INSUFFICIENT_STOCK,
              "No hay stock suficiente para uno de los productos.",
            );
          }
          reject(
            CHECKOUT_ERROR_CODES.PRODUCT_NOT_SELLABLE,
            "Un producto no está disponible para la venta.",
          );
        }
      }

      for (const line of prepared.lines) {
        const insertedItems = await tx
          .insert(orderItems)
          .values({
            orderId,
            productId: line.productId,
            productNameSnapshot: line.productNameSnapshot,
            unitPriceCents: line.unitPriceCents,
            quantity: line.quantity,
            lineTotalCents: line.lineTotalCents,
            itemNotes: "",
          })
          .returning({ id: orderItems.id });

        const orderItemId = insertedItems[0]?.id;
        if (!orderItemId) {
          reject(
            CHECKOUT_ERROR_CODES.ORDER_PERSISTENCE_FAILED,
            "No se pudo crear el pedido.",
          );
        }

        if (line.options.length > 0) {
          await tx.insert(orderItemOptions).values(
            line.options.map((option) => ({
              orderItemId,
              optionGroupId: option.optionGroupId,
              optionChoiceId: option.optionChoiceId,
              optionGroupNameSnapshot: option.optionGroupNameSnapshot,
              optionChoiceNameSnapshot: option.optionChoiceNameSnapshot,
              priceDeltaCents: option.priceDeltaCents,
              quantity: option.quantity,
            })),
          );
        }
      }

      await tx.insert(orderEvents).values({
        orderId,
        fromStatus: null,
        toStatus: "PENDING",
        actorType: "CUSTOMER",
        actorId: prepared.customerUserId,
        reason: null,
      });

      if (prepared.fulfillmentMethod === "PICKUP") {
        const compat = assertOrderDeliveryCompatibility(
          { fulfillmentMethod: "PICKUP" },
          null,
        );
        if (!compat.ok) {
          reject(
            CHECKOUT_ERROR_CODES.INVALID_FULFILLMENT,
            "El pedido de retiro no puede tener envío.",
          );
        }
      } else {
        const delivery = prepared.delivery;
        if (!delivery) {
          reject(
            CHECKOUT_ERROR_CODES.DELIVERY_ADDRESS_REQUIRED,
            "Completá la dirección de entrega.",
          );
        }
        const compat = assertOrderDeliveryCompatibility(
          { fulfillmentMethod: "MERCHANT_DELIVERY" },
          { provider: "MERCHANT" },
        );
        if (!compat.ok) {
          reject(
            CHECKOUT_ERROR_CODES.INVALID_FULFILLMENT,
            "El envío del pedido no es válido.",
          );
        }
        await tx.insert(deliveries).values({
          orderId,
          provider: "MERCHANT",
          status: "PENDING",
          feeCents: delivery.feeCents,
          estimatedMinutes: delivery.estimatedMinutes,
          addressCityId: delivery.cityId,
          addressZoneId: delivery.zoneId,
          addressCityNameSnapshot: delivery.cityNameSnapshot,
          addressZoneNameSnapshot: delivery.zoneNameSnapshot,
          addressStreet: delivery.street,
          addressNumber: delivery.number,
          addressFloorApartment: delivery.floorApartment,
          addressReference: delivery.reference,
        });
      }

      return {
        orderId,
        status: "PENDING" as const,
        merchantId: prepared.merchantId,
        totalCents: moneyCents(prepared.totalCents),
        fulfillmentMethod: prepared.fulfillmentMethod,
      };
    });

    return { status: "created", order: created };
  } catch (error) {
    const checkout = checkoutErrorFromUnknown(error);
    if (checkout) {
      return { status: "rejected", error: checkout };
    }
    if (isUniqueViolation(error)) {
      return { status: "unique_violation" };
    }
    return {
      status: "rejected",
      error: checkoutError(
        CHECKOUT_ERROR_CODES.ORDER_PERSISTENCE_FAILED,
        "No se pudo crear el pedido.",
      ),
    };
  }
}

const PG_INT_MAX = 2_147_483_647;

function mapCancelPolicyError(code: string): CheckoutApplicationError {
  if (code === "ORDER_CANCEL_DELIVERY_IN_TRANSIT") {
    return checkoutError(
      CHECKOUT_ERROR_CODES.DELIVERY_STATE_CONFLICT,
      "No se puede cancelar el pedido mientras el envío está en curso.",
    );
  }
  if (code === "ORDER_CANCEL_SYSTEM_REASON_REQUIRED") {
    return checkoutError(
      CHECKOUT_ERROR_CODES.INVALID_CANCEL_REASON,
      "El motivo de cancelación no es válido.",
    );
  }
  return checkoutError(
    CHECKOUT_ERROR_CODES.ORDER_NOT_CANCELABLE,
    "No se puede cancelar el pedido.",
  );
}

/**
 * Cancels an Order inside one transaction.
 * SELECT FOR UPDATE serializes concurrent cancels so TRACKED restock happens once.
 *
 * Live product restock: only when product_id is present and stock_mode is still
 * TRACKED. There is no historical stock_mode snapshot on order_items.
 */
export async function cancelOrderInTransaction(
  command: CancelOrderCommand,
): Promise<CancelOrderPersistResult> {
  const db = getDb();

  try {
    return await db.transaction(async (tx) => {
      const scoped =
        command.expectedMerchantId != null
          ? and(
              eq(orders.id, command.orderId),
              eq(orders.merchantId, command.expectedMerchantId),
            )
          : eq(orders.id, command.orderId);

      const orderRows = await tx
        .select({
          id: orders.id,
          status: orders.status,
          fulfillmentMethod: orders.fulfillmentMethod,
        })
        .from(orders)
        .where(scoped)
        .for("update")
        .limit(1);

      const order = orderRows[0];
      if (!order) {
        reject(CHECKOUT_ERROR_CODES.ORDER_NOT_FOUND, "El pedido no existe.");
      }

      if (order.status === "CANCELED") {
        return {
          status: "already_canceled" as const,
          orderId: order.id,
        };
      }

      if (
        command.expectedCurrentStatus != null &&
        order.status !== command.expectedCurrentStatus
      ) {
        reject(
          CHECKOUT_ERROR_CODES.ORDER_NOT_CANCELABLE,
          "El pedido ya no se puede rechazar.",
        );
      }

      const itemRows = await tx
        .select({
          productId: orderItems.productId,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));

      const deliveryRows = await tx
        .select({
          id: deliveries.id,
          provider: deliveries.provider,
          status: deliveries.status,
        })
        .from(deliveries)
        .where(eq(deliveries.orderId, order.id))
        .limit(1);
      const delivery = deliveryRows[0] ?? null;

      if (delivery?.status === "DELIVERED") {
        reject(
          CHECKOUT_ERROR_CODES.DELIVERY_STATE_CONFLICT,
          "No se puede cancelar un pedido cuya entrega ya fue completada.",
        );
      }

      const policy = canCancelOrder({
        actor: command.actorType,
        orderStatus: order.status as OrderStatus,
        delivery: delivery
          ? { status: delivery.status as DeliveryStatus }
          : null,
        cancelReason: command.reason,
      });
      if (!policy.ok) {
        throw new CheckoutTxError(mapCancelPolicyError(policy.error.code));
      }

      const transition = transitionOrderStatus(
        order.status as OrderStatus,
        "CANCELED",
      );
      if (!transition.ok) {
        throw new CheckoutTxError(mapCancelPolicyError(transition.error.code));
      }

      const previousStatus = order.status as OrderStatus;

      await tx
        .update(orders)
        .set({
          status: "CANCELED",
          canceledAt: command.now,
          canceledBy: command.actorType,
          cancelReason: command.reason,
          updatedAt: command.now,
        })
        .where(eq(orders.id, order.id));

      const demand = new Map<string, number>();
      for (const item of itemRows) {
        if (!item.productId) {
          continue;
        }
        demand.set(
          item.productId,
          (demand.get(item.productId) ?? 0) + item.quantity,
        );
      }

      let restoredTrackedQuantity = 0;
      for (const [productId, quantity] of demand) {
        const liveRows = await tx
          .select({
            id: products.id,
            stockMode: products.stockMode,
            stockQuantity: products.stockQuantity,
          })
          .from(products)
          .where(eq(products.id, productId))
          .limit(1);
        const live = liveRows[0];
        if (
          !live ||
          live.stockMode !== "TRACKED" ||
          live.stockQuantity == null
        ) {
          continue;
        }
        if (live.stockQuantity + quantity > PG_INT_MAX) {
          reject(
            CHECKOUT_ERROR_CODES.ORDER_PERSISTENCE_FAILED,
            "No se pudo restaurar el stock.",
          );
        }

        const updated = await tx
          .update(products)
          .set({
            stockQuantity: sql`${products.stockQuantity} + ${quantity}`,
            updatedAt: command.now,
          })
          .where(
            and(eq(products.id, productId), eq(products.stockMode, "TRACKED")),
          )
          .returning({ id: products.id });

        if (updated.length > 0) {
          restoredTrackedQuantity += quantity;
        }
      }

      let deliveryCanceled = false;
      if (delivery && delivery.status !== "DELIVERED") {
        if (!isDeliveryTerminalStatus(delivery.status as DeliveryStatus)) {
          const nextDelivery = transitionDeliveryStatus(
            delivery.provider as DeliveryProvider,
            delivery.status as DeliveryStatus,
            "CANCELED",
          );
          if (!nextDelivery.ok) {
            reject(
              CHECKOUT_ERROR_CODES.DELIVERY_STATE_CONFLICT,
              "No se puede cancelar el envío asociado.",
            );
          }
          await tx
            .update(deliveries)
            .set({
              status: "CANCELED",
              updatedAt: command.now,
            })
            .where(eq(deliveries.id, delivery.id));
          deliveryCanceled = true;
        }
      }

      await tx.insert(orderEvents).values({
        orderId: order.id,
        fromStatus: previousStatus,
        toStatus: "CANCELED",
        actorType: command.actorType,
        actorId: command.actorId,
        reason: command.reason,
      });

      return {
        status: "canceled" as const,
        result: {
          orderId: order.id,
          previousStatus,
          status: "CANCELED" as const,
          restoredTrackedQuantity,
          deliveryCanceled,
        },
      };
    });
  } catch (error) {
    const checkout = checkoutErrorFromUnknown(error);
    if (checkout) {
      return { status: "rejected", error: checkout };
    }
    return {
      status: "rejected",
      error: checkoutError(
        CHECKOUT_ERROR_CODES.ORDER_PERSISTENCE_FAILED,
        "No se pudo cancelar el pedido.",
      ),
    };
  }
}
