import type { MoneyCents } from "../money/money-cents";
import type { PaymentMethodCode } from "../merchant/enums";
import type { DeliveryAddressSnapshot } from "../shared/address";
import type {
  DeliveryId,
  IdempotencyKey,
  MerchantId,
  OrderEventId,
  OrderId,
  OrderItemId,
  ProductId,
  UserId,
} from "../shared/ids";
import type {
  CancelReason,
  FulfillmentMethod,
  OrderActorType,
  OrderStatus,
} from "./enums";

export type PaymentMethodSnapshot = {
  code: PaymentMethodCode;
  label: string;
  instructions: string;
};

export type OrderOptionSnapshot = {
  optionGroupNameSnapshot: string;
  optionChoiceNameSnapshot: string;
  priceDeltaCents: MoneyCents;
  quantity: number;
};

export type OrderItem = {
  id: OrderItemId;
  orderId: OrderId;
  productId: ProductId;
  productNameSnapshot: string;
  unitPriceCents: MoneyCents;
  quantity: number;
  lineTotalCents: MoneyCents;
  itemNotes: string;
  options: OrderOptionSnapshot[];
};

export type Order = {
  id: OrderId;
  merchantId: MerchantId;
  customerUserId: UserId | null;
  status: OrderStatus;
  fulfillmentMethod: FulfillmentMethod;
  /**
   * Present when fulfillmentMethod is MERCHANT_DELIVERY or PLATFORM_DELIVERY.
   * Absent for PICKUP.
   */
  deliveryId: DeliveryId | null;
  paymentMethodSnapshot: PaymentMethodSnapshot;
  deliveryAddressSnapshot: DeliveryAddressSnapshot | null;
  itemSubtotalCents: MoneyCents;
  optionsSubtotalCents: MoneyCents;
  orderSubtotalCents: MoneyCents;
  deliveryFeeCents: MoneyCents;
  totalCents: MoneyCents;
  /** Client-supplied key; unique constraint arrives in Phase 2B persistence. */
  idempotencyKey: IdempotencyKey;
  canceledAt: string | null;
  canceledBy: OrderActorType | null;
  cancelReason: CancelReason | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderEvent = {
  id: OrderEventId;
  orderId: OrderId;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorType: OrderActorType;
  actorId: string | null;
  reason: string | null;
  createdAt: string;
};
