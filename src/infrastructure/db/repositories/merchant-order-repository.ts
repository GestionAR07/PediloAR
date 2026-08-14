import "server-only";

import { and, asc, eq, gte, inArray, or } from "drizzle-orm";
import {
  ORDER_NON_TERMINAL_STATUSES,
  ORDER_TERMINAL_STATUSES,
} from "@/domain/order/transitions";
import { getDb } from "../client";
import { deliveries, orderItemOptions, orderItems, orders } from "../schema";

export type MerchantOrderOptionRecord = {
  groupNameSnapshot: string;
  choiceNameSnapshot: string;
  priceDeltaCents: number;
  quantity: number;
};

export type MerchantOrderItemRecord = {
  id: string;
  productNameSnapshot: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  itemNotes: string;
  options: MerchantOrderOptionRecord[];
};

export type MerchantOrderDeliveryRecord = {
  status: string;
  zoneNameSnapshot: string | null;
  cityNameSnapshot: string | null;
  street: string;
  number: string;
  floorApartment: string | null;
  reference: string | null;
  estimatedMinutes: number | null;
};

export type MerchantOrderRecord = {
  id: string;
  createdAt: Date;
  status: string;
  fulfillmentMethod: string;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string;
  orderSubtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  paymentMethodCode: string;
  paymentMethodLabel: string;
  paymentMethodInstructions: string;
  canceledBy: string | null;
  cancelReason: string | null;
  items: MerchantOrderItemRecord[];
  delivery: MerchantOrderDeliveryRecord | null;
};

/**
 * Read-only merchant-scoped orders: every non-terminal row, plus terminals
 * created on/after the merchant-local start of day.
 * Uses existing orders_merchant_id_idx, orders_merchant_status_idx, and
 * orders_merchant_created_at_idx. No new index in this phase.
 */
export async function listOrdersForMerchant(
  merchantId: string,
  terminalSince: Date,
): Promise<MerchantOrderRecord[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: orders.id,
      createdAt: orders.createdAt,
      status: orders.status,
      fulfillmentMethod: orders.fulfillmentMethod,
      customerNameSnapshot: orders.customerNameSnapshot,
      customerPhoneSnapshot: orders.customerPhoneSnapshot,
      orderSubtotalCents: orders.orderSubtotalCents,
      deliveryFeeCents: orders.deliveryFeeCents,
      totalCents: orders.totalCents,
      paymentMethodCode: orders.paymentMethodCode,
      paymentMethodLabel: orders.paymentMethodLabel,
      paymentMethodInstructions: orders.paymentMethodInstructions,
      canceledBy: orders.canceledBy,
      cancelReason: orders.cancelReason,
    })
    .from(orders)
    .where(
      and(
        eq(orders.merchantId, merchantId),
        or(
          inArray(orders.status, [...ORDER_NON_TERMINAL_STATUSES]),
          and(
            inArray(orders.status, [...ORDER_TERMINAL_STATUSES]),
            gte(orders.createdAt, terminalSince),
          ),
        ),
      ),
    )
    .orderBy(asc(orders.createdAt));

  return hydrateMerchantOrders(
    rows.map((row) => ({
      ...row,
      orderSubtotalCents: Number(row.orderSubtotalCents),
      deliveryFeeCents: Number(row.deliveryFeeCents),
      totalCents: Number(row.totalCents),
    })),
  );
}

export async function findOrderForMerchant(
  merchantId: string,
  orderId: string,
): Promise<MerchantOrderRecord | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: orders.id,
      createdAt: orders.createdAt,
      status: orders.status,
      fulfillmentMethod: orders.fulfillmentMethod,
      customerNameSnapshot: orders.customerNameSnapshot,
      customerPhoneSnapshot: orders.customerPhoneSnapshot,
      orderSubtotalCents: orders.orderSubtotalCents,
      deliveryFeeCents: orders.deliveryFeeCents,
      totalCents: orders.totalCents,
      paymentMethodCode: orders.paymentMethodCode,
      paymentMethodLabel: orders.paymentMethodLabel,
      paymentMethodInstructions: orders.paymentMethodInstructions,
      canceledBy: orders.canceledBy,
      cancelReason: orders.cancelReason,
    })
    .from(orders)
    .where(and(eq(orders.merchantId, merchantId), eq(orders.id, orderId)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  const hydrated = await hydrateMerchantOrders([
    {
      ...row,
      orderSubtotalCents: Number(row.orderSubtotalCents),
      deliveryFeeCents: Number(row.deliveryFeeCents),
      totalCents: Number(row.totalCents),
    },
  ]);
  return hydrated[0] ?? null;
}

type OrderRow = Omit<MerchantOrderRecord, "items" | "delivery">;

async function hydrateMerchantOrders(
  orderRows: OrderRow[],
): Promise<MerchantOrderRecord[]> {
  if (orderRows.length === 0) {
    return [];
  }

  const db = getDb();
  const orderIds = orderRows.map((row) => row.id);

  const itemRows = await db
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      productNameSnapshot: orderItems.productNameSnapshot,
      quantity: orderItems.quantity,
      unitPriceCents: orderItems.unitPriceCents,
      lineTotalCents: orderItems.lineTotalCents,
      itemNotes: orderItems.itemNotes,
    })
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds))
    .orderBy(asc(orderItems.createdAt));

  const itemIds = itemRows.map((row) => row.id);
  const optionRows =
    itemIds.length === 0
      ? []
      : await db
          .select({
            orderItemId: orderItemOptions.orderItemId,
            groupNameSnapshot: orderItemOptions.optionGroupNameSnapshot,
            choiceNameSnapshot: orderItemOptions.optionChoiceNameSnapshot,
            priceDeltaCents: orderItemOptions.priceDeltaCents,
            quantity: orderItemOptions.quantity,
          })
          .from(orderItemOptions)
          .where(inArray(orderItemOptions.orderItemId, itemIds))
          .orderBy(asc(orderItemOptions.createdAt));

  const deliveryRows = await db
    .select({
      orderId: deliveries.orderId,
      status: deliveries.status,
      zoneNameSnapshot: deliveries.addressZoneNameSnapshot,
      cityNameSnapshot: deliveries.addressCityNameSnapshot,
      street: deliveries.addressStreet,
      number: deliveries.addressNumber,
      floorApartment: deliveries.addressFloorApartment,
      reference: deliveries.addressReference,
      estimatedMinutes: deliveries.estimatedMinutes,
    })
    .from(deliveries)
    .where(inArray(deliveries.orderId, orderIds));

  const optionsByItem = new Map<string, MerchantOrderOptionRecord[]>();
  for (const option of optionRows) {
    const list = optionsByItem.get(option.orderItemId) ?? [];
    list.push({
      groupNameSnapshot: option.groupNameSnapshot,
      choiceNameSnapshot: option.choiceNameSnapshot,
      priceDeltaCents: Number(option.priceDeltaCents),
      quantity: option.quantity,
    });
    optionsByItem.set(option.orderItemId, list);
  }

  const itemsByOrder = new Map<string, MerchantOrderItemRecord[]>();
  for (const item of itemRows) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push({
      id: item.id,
      productNameSnapshot: item.productNameSnapshot,
      quantity: item.quantity,
      unitPriceCents: Number(item.unitPriceCents),
      lineTotalCents: Number(item.lineTotalCents),
      itemNotes: item.itemNotes,
      options: optionsByItem.get(item.id) ?? [],
    });
    itemsByOrder.set(item.orderId, list);
  }

  const deliveryByOrder = new Map<string, MerchantOrderDeliveryRecord>();
  for (const delivery of deliveryRows) {
    deliveryByOrder.set(delivery.orderId, {
      status: delivery.status,
      zoneNameSnapshot: delivery.zoneNameSnapshot,
      cityNameSnapshot: delivery.cityNameSnapshot,
      street: delivery.street,
      number: delivery.number,
      floorApartment: delivery.floorApartment,
      reference: delivery.reference,
      estimatedMinutes: delivery.estimatedMinutes,
    });
  }

  return orderRows.map((row) => ({
    ...row,
    items: itemsByOrder.get(row.id) ?? [],
    delivery: deliveryByOrder.get(row.id) ?? null,
  }));
}
