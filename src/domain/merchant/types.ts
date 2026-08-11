import type { MoneyCents } from "../money/money-cents";
import type {
  CityId,
  MerchantId,
  MerchantUserId,
  UserId,
  ZoneId,
} from "../shared/ids";
import type {
  MerchantStatus,
  MerchantUserRole,
  PaymentMethodCode,
  Weekday,
} from "./enums";

export type Merchant = {
  id: MerchantId;
  cityId: CityId;
  zoneId: ZoneId;
  name: string;
  slug: string;
  description: string;
  status: MerchantStatus;
  pickupEnabled: boolean;
  merchantDeliveryEnabled: boolean;
  /**
   * Conceptual flag for future platform courier network.
   * MVP: always false / operationally disabled.
   */
  platformDeliveryEnabled: boolean;
  preparationMinutes: number;
};

export type MerchantUser = {
  id: MerchantUserId;
  merchantId: MerchantId;
  userId: UserId;
  role: MerchantUserRole;
  active: boolean;
};

/**
 * One open interval for a weekday.
 * Multiple rows per weekday allow split schedules (e.g. 09–13 and 17–21).
 * Closed days simply have no intervals.
 */
export type MerchantOpeningInterval = {
  merchantId: MerchantId;
  weekday: Weekday;
  /** Minutes from local midnight [0, 1440). */
  openMinute: number;
  /** Minutes from local midnight (0, 1440]; exclusive or inclusive end — see assert. */
  closeMinute: number;
};

export type MerchantDeliveryZone = {
  merchantId: MerchantId;
  zoneId: ZoneId;
  deliveryFeeCents: MoneyCents;
  minimumOrderCents: MoneyCents;
  estimatedMinutes: number;
  active: boolean;
};

/**
 * Informative payment method offered by a merchant.
 * Platform does not process payments in MVP — customer pays the merchant directly.
 */
export type MerchantPaymentMethod = {
  merchantId: MerchantId;
  code: PaymentMethodCode;
  label: string;
  instructions: string;
  active: boolean;
  sortOrder: number;
};
