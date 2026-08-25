import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../client";
import {
  deliveries,
  orderEvents,
  orderItemOptions,
  orderItems,
  orders,
} from "../schema";

export type CustomerOrderSummaryRecord = {
  id: string;
  merchantNameSnapshot: string;
  status: string;
  fulfillmentMethod: string;
  totalCents: number;
  deliveryStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomerOrderOptionRecord = {
  groupNameSnapshot: string;
  choiceNameSnapshot: string;
  priceDeltaCents: number;
  quantity: number;
};

export type CustomerOrderItemRecord = {
  id: string;
  productNameSnapshot: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  options: CustomerOrderOptionRecord[];
};

export type CustomerOrderEventRecord = {
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  createdAt: Date;
};

export type CustomerOrderDetailRecord = CustomerOrderSummaryRecord & {
  customerNameSnapshot: string;
  customerPhoneSnapshot: string;
  orderSubtotalCents: number;
  deliveryFeeCents: number;
  paymentMethodLabel: string;
  paymentMethodInstructions: string;
  deliveryAddress: {
    cityName: string | null;
    zoneName: string | null;
    street: string;
    number: string;
    floorApartment: string | null;
    reference: string | null;
    estimatedMinutes: number | null;
  } | null;
  canceledBy: string | null;
  cancelReason: string | null;
  items: CustomerOrderItemRecord[];
  events: CustomerOrderEventRecord[];
};

/**
 * Customer-owned summaries. Ownership is part of the SQL predicate and must
 * never be applied only after loading rows.
 */
export async function listOrdersForCustomer(
  customerUserId: string,
  limit = 50,
): Promise<CustomerOrderSummaryRecord[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: orders.id,
      merchantNameSnapshot: orders.merchantNameSnapshot,
      status: orders.status,
      fulfillmentMethod: orders.fulfillmentMethod,
      totalCents: orders.totalCents,
      deliveryStatus: deliveries.status,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .leftJoin(deliveries, eq(deliveries.orderId, orders.id))
    .where(eq(orders.customerUserId, customerUserId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    totalCents: Number(row.totalCents),
  }));
}

/** Secure lookup: an order id without the matching customer id is not found. */
export async function findOrderForCustomer(
  customerUserId: string,
  orderId: string,
): Promise<CustomerOrderDetailRecord | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: orders.id,
      merchantNameSnapshot: orders.merchantNameSnapshot,
      status: orders.status,
      fulfillmentMethod: orders.fulfillmentMethod,
      totalCents: orders.totalCents,
      customerNameSnapshot: orders.customerNameSnapshot,
      customerPhoneSnapshot: orders.customerPhoneSnapshot,
      orderSubtotalCents: orders.orderSubtotalCents,
      deliveryFeeCents: orders.deliveryFeeCents,
      paymentMethodLabel: orders.paymentMethodLabel,
      paymentMethodInstructions: orders.paymentMethodInstructions,
      canceledBy: orders.canceledBy,
      cancelReason: orders.cancelReason,
      deliveryStatus: deliveries.status,
      deliveryCityName: deliveries.addressCityNameSnapshot,
      deliveryZoneName: deliveries.addressZoneNameSnapshot,
      deliveryStreet: deliveries.addressStreet,
      deliveryNumber: deliveries.addressNumber,
      deliveryFloorApartment: deliveries.addressFloorApartment,
      deliveryReference: deliveries.addressReference,
      deliveryEstimatedMinutes: deliveries.estimatedMinutes,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .leftJoin(deliveries, eq(deliveries.orderId, orders.id))
    .where(
      and(eq(orders.id, orderId), eq(orders.customerUserId, customerUserId)),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const itemRows = await db
    .select({
      id: orderItems.id,
      productNameSnapshot: orderItems.productNameSnapshot,
      unitPriceCents: orderItems.unitPriceCents,
      quantity: orderItems.quantity,
      lineTotalCents: orderItems.lineTotalCents,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.createdAt));

  const itemIds = itemRows.map((item) => item.id);
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

  const eventRows = await db
    .select({
      fromStatus: orderEvents.fromStatus,
      toStatus: orderEvents.toStatus,
      reason: orderEvents.reason,
      createdAt: orderEvents.createdAt,
    })
    .from(orderEvents)
    .where(eq(orderEvents.orderId, orderId))
    .orderBy(asc(orderEvents.createdAt));

  const optionsByItem = new Map<string, CustomerOrderOptionRecord[]>();
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

  return {
    id: row.id,
    merchantNameSnapshot: row.merchantNameSnapshot,
    status: row.status,
    fulfillmentMethod: row.fulfillmentMethod,
    totalCents: Number(row.totalCents),
    deliveryStatus: row.deliveryStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    customerNameSnapshot: row.customerNameSnapshot,
    customerPhoneSnapshot: row.customerPhoneSnapshot,
    orderSubtotalCents: Number(row.orderSubtotalCents),
    deliveryFeeCents: Number(row.deliveryFeeCents),
    paymentMethodLabel: row.paymentMethodLabel,
    paymentMethodInstructions: row.paymentMethodInstructions,
    deliveryAddress:
      row.deliveryStreet && row.deliveryNumber
        ? {
            cityName: row.deliveryCityName,
            zoneName: row.deliveryZoneName,
            street: row.deliveryStreet,
            number: row.deliveryNumber,
            floorApartment: row.deliveryFloorApartment,
            reference: row.deliveryReference,
            estimatedMinutes: row.deliveryEstimatedMinutes,
          }
        : null,
    canceledBy: row.canceledBy,
    cancelReason: row.cancelReason,
    items: itemRows.map((item) => ({
      id: item.id,
      productNameSnapshot: item.productNameSnapshot,
      unitPriceCents: Number(item.unitPriceCents),
      quantity: item.quantity,
      lineTotalCents: Number(item.lineTotalCents),
      options: optionsByItem.get(item.id) ?? [],
    })),
    events: eventRows,
  };
}
