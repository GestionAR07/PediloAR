import type { MoneyCents } from "../money/money-cents";
import type { PaymentMethodCode } from "../merchant/enums";
import type { DeliveryAddressSnapshot } from "../shared/address";
import type {
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

/**
 * Commercial commitment. Logistics live on Delivery (Delivery.orderId → Order.id).
 * Order intentionally has no deliveryId — unidirectional relation only.
 */
export type Order = {
  id: OrderId;
  merchantId: MerchantId;
  customerUserId: UserId | null;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string;
  merchantNameSnapshot: string;
  status: OrderStatus;
  fulfillmentMethod: FulfillmentMethod;
  paymentMethodSnapshot: PaymentMethodSnapshot;
  deliveryAddressSnapshot: DeliveryAddressSnapshot | null;
  itemSubtotalCents: MoneyCents;
  optionsSubtotalCents: MoneyCents;
  orderSubtotalCents: MoneyCents;
  deliveryFeeCents: MoneyCents;
  totalCents: MoneyCents;
  /**
   * Client-supplied key; domain validates shape via parseIdempotencyKey.
   * UNIQUE constraint arrives in Phase 2B persistence.
   */
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
