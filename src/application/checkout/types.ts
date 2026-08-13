import type { MoneyCents } from "@/domain/money/money-cents";
import type {
  MerchantStatus,
  PaymentMethodCode,
} from "@/domain/merchant/enums";
import type { FulfillmentMethod } from "@/domain/order/enums";
import type { IdempotencyKey } from "@/domain/shared/ids";

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
   */
  intentFingerprint: string;
};

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
