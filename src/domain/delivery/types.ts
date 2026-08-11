import type { MoneyCents } from "../money/money-cents";
import type { DeliveryAddressSnapshot } from "../shared/address";
import type { DeliveryId, OrderId } from "../shared/ids";
import type { DeliveryProvider, DeliveryStatus } from "./enums";

/**
 * Logistics entity separate from Order (commercial commitment).
 * CourierProfile is intentionally not modeled in Phase 2A.
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
