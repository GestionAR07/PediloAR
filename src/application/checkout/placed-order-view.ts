import type { PlacedOrderResult } from "./types";

export function shortOrderReference(orderId: string): string {
  return orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export type PublicPlacedOrder = {
  orderId: string;
  orderRef: string;
  merchantId: string;
  totalCents: number;
  fulfillmentMethod: string;
  status: "PENDING";
  replayed: boolean;
};

export function toPublicPlacedOrder(
  result: PlacedOrderResult,
): PublicPlacedOrder {
  return {
    orderId: result.orderId,
    orderRef: shortOrderReference(result.orderId),
    merchantId: result.merchantId,
    totalCents: Number(result.totalCents),
    fulfillmentMethod: result.fulfillmentMethod,
    status: "PENDING",
    replayed: result.replayed,
  };
}
