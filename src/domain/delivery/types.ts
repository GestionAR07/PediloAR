import type { MoneyCents } from "../money/money-cents";
import type { DeliveryAddressSnapshot } from "../shared/address";
import type { DeliveryId, OrderId } from "../shared/ids";
import type { DeliveryProvider, DeliveryStatus } from "./enums";

/**
 * Logistics entity separate from Order (commercial commitment).
 * Unidirectional link: orderId → Order.id (Order has no deliveryId).
 * Phase 2B: FK + UNIQUE on orderId. CourierProfile not modeled in 2A.
 */
export type Delivery = {
  id: DeliveryId;
  orderId: OrderId;
  provider: DeliveryProvider;
  status: DeliveryStatus;
  addressSnapshot: DeliveryAddressSnapshot;
  feeCents: MoneyCents;
  estimatedMinutes: number | null;
  createdAt: string;
  updatedAt: string;
};
