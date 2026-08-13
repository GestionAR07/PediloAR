import type { MoneyCents } from "@/domain/money/money-cents";
import type {
  MerchantStatus,
  PaymentMethodCode,
} from "@/domain/merchant/enums";
import type {
  CancelReason,
  FulfillmentMethod,
  OrderActorType,
} from "@/domain/order/enums";
import type { IdempotencyKey } from "@/domain/shared/ids";
import type { CheckoutApplicationError } from "./errors";

/**
 * Untrusted checkout payload. Price/name snapshots from the browser are ignored
 * even if a caller spreads extra fields onto this object.
 */
export type PrepareOrderInput = {
  merchantId: string;
  /**
   * Discovery / pickup zone. Distinct from delivery.zoneId.
   * Required for PICKUP (must match merchant home zone).
   */
  customerZoneId?: string | null;
  customer: {
    name: string;
    phone: string;
  };
  fulfillmentMethod: string;
  delivery?: {
    zoneId: string;
    street: string;
    number: string;
    floorApartment?: string;
    reference?: string;
  } | null;
  paymentMethodCode: string;
  idempotencyKey: string;
  /**
   * Fingerprint of the authoritative quote the customer reviewed.
   * Compared after prepareOrder; never used as a price authority.
   * Ignored on idempotent replay of an existing Order.
   */
  expectedQuoteFingerprint?: string | null;
  lines: PrepareOrderLineInput[];
};

export type PrepareOrderLineInput = {
  productId: string;
  quantity: number;
  groups?: PrepareOrderGroupInput[];
};

export type PrepareOrderGroupInput = {
  groupId: string;
  selections: Array<{
    choiceId: string;
    quantity: number;
  }>;
};

export type CheckoutMerchantRecord = {
  id: string;
  name: string;
  status: MerchantStatus | string;
  cityId: string;
  cityName: string;
  zoneId: string;
  zoneName: string;
  pickupEnabled: boolean;
  merchantDeliveryEnabled: boolean;
  platformDeliveryEnabled: boolean;
  acceptingOrders: boolean;
  pausedUntil: Date | null;
  /** Present when loaded from persistence; omitted in some test doubles. */
  preparationMinutes?: number;
};

export type CheckoutProductRecord = {
  id: string;
  merchantId: string;
  name: string;
  priceCents: number;
  active: boolean;
  available: boolean;
  stockMode: string;
  stockQuantity: number | null;
  sortOrder: number;
};

export type CheckoutOptionGroupRecord = {
  id: string;
  productId: string;
  name: string;
  selectionMode: string;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  active: boolean;
};

export type CheckoutOptionChoiceRecord = {
  id: string;
  groupId: string;
  name: string;
  priceDeltaCents: number;
  sortOrder: number;
  active: boolean;
};

export type CheckoutPaymentMethodRecord = {
  code: string;
  label: string;
  instructions: string;
  active: boolean;
};

export type CheckoutDeliveryZoneRecord = {
  merchantId: string;
  zoneId: string;
  zoneName: string;
  cityId: string;
  cityName: string;
  deliveryFeeCents: number;
  minimumOrderCents: number;
  estimatedMinutes: number;
  active: boolean;
};

export type PreparedPaymentSnapshot = {
  code: PaymentMethodCode;
  label: string;
  instructions: string;
};

export type PreparedOptionSnapshot = {
  optionGroupId: string;
  optionChoiceId: string;
  optionGroupNameSnapshot: string;
  optionChoiceNameSnapshot: string;
  priceDeltaCents: MoneyCents;
  quantity: number;
};

export type PreparedOrderLine = {
  productId: string;
  productNameSnapshot: string;
  /** Live product base price — never the configured unit price. */
  unitPriceCents: MoneyCents;
  quantity: number;
  options: PreparedOptionSnapshot[];
  lineTotalCents: MoneyCents;
};

export type PreparedDeliverySnapshot = {
  cityId: string;
  zoneId: string;
  cityNameSnapshot: string;
  zoneNameSnapshot: string;
  street: string;
  number: string;
  floorApartment: string;
  reference: string;
  feeCents: MoneyCents;
  estimatedMinutes: number;
};

export type PreparedOrder = {
  merchantId: string;
  merchantNameSnapshot: string;
  customerUserId: null;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string;
  fulfillmentMethod: FulfillmentMethod;
  paymentMethodSnapshot: PreparedPaymentSnapshot;
  itemSubtotalCents: MoneyCents;
  optionsSubtotalCents: MoneyCents;
  orderSubtotalCents: MoneyCents;
  deliveryFeeCents: MoneyCents;
  totalCents: MoneyCents;
  delivery: PreparedDeliverySnapshot | null;
  lines: PreparedOrderLine[];
  idempotencyKey: IdempotencyKey;
  /**
   * Canonical intent of IDs/quantities/contact/fulfillment that 6B.3 can
   * reconstruct from persisted order snapshots (no new schema column).
   * PICKUP customerZoneId is not included.
   */
  intentFingerprint: string;
};

export type PlacedOrderResult = {
  orderId: string;
  status: "PENDING";
  merchantId: string;
  totalCents: MoneyCents;
  fulfillmentMethod: FulfillmentMethod;
  replayed: boolean;
};

export type PersistedCheckoutOrder = {
  orderId: string;
  status: string;
  merchantId: string;
  totalCents: number;
  fulfillmentMethod: string;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string;
  paymentMethodCode: string;
  deliveryZoneId: string | null;
  deliveryStreet: string | null;
  deliveryNumber: string | null;
  deliveryFloorApartment: string | null;
  deliveryReference: string | null;
  lines: Array<{
    productId: string | null;
    quantity: number;
    options: Array<{
      optionGroupId: string | null;
      optionChoiceId: string | null;
      quantity: number;
    }>;
  }>;
};

export type PersistPreparedOrderResult =
  | { status: "created"; order: Omit<PlacedOrderResult, "replayed"> }
  | { status: "unique_violation" }
  | { status: "rejected"; error: CheckoutApplicationError };

export type CancelOrderInput = {
  orderId: string;
  actor: {
    type: string;
    id?: string | null;
  };
  reason: string;
};

export type CanceledOrderResult = {
  orderId: string;
  previousStatus: string;
  status: "CANCELED";
  restoredTrackedQuantity: number;
  deliveryCanceled: boolean;
};

export type CancelOrderCommand = {
  orderId: string;
  actorType: OrderActorType;
  actorId: string | null;
  reason: CancelReason;
  now: Date;
};

export type CancelOrderPersistResult =
  | { status: "canceled"; result: CanceledOrderResult }
  | { status: "already_canceled"; orderId: string }
  | { status: "rejected"; error: CheckoutApplicationError };

export type PrepareOrderDeps = {
  now: () => Date;
  findMerchantById: (
    merchantId: string,
  ) => Promise<CheckoutMerchantRecord | null>;
  listProductsByIds: (productIds: string[]) => Promise<CheckoutProductRecord[]>;
  listOptionGroupsForProducts: (
    productIds: string[],
  ) => Promise<CheckoutOptionGroupRecord[]>;
  listOptionChoicesForGroups: (
    groupIds: string[],
  ) => Promise<CheckoutOptionChoiceRecord[]>;
  listPaymentMethodsForMerchant: (
    merchantId: string,
  ) => Promise<CheckoutPaymentMethodRecord[]>;
  listDeliveryZonesForMerchant: (
    merchantId: string,
  ) => Promise<CheckoutDeliveryZoneRecord[]>;
};
