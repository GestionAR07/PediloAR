export const MERCHANT_STATUSES = ["DRAFT", "ACTIVE", "SUSPENDED"] as const;
export type MerchantStatus = (typeof MERCHANT_STATUSES)[number];

export const MERCHANT_USER_ROLES = ["OWNER", "STAFF"] as const;
export type MerchantUserRole = (typeof MERCHANT_USER_ROLES)[number];

export const PAYMENT_METHOD_CODES = [
  "CASH",
  "TRANSFER",
  "MERCADO_PAGO",
] as const;
export type PaymentMethodCode = (typeof PAYMENT_METHOD_CODES)[number];

/** Weekday: 0 = Sunday … 6 = Saturday (ISO-friendly alternative: keep explicit). */
export const WEEKDAY_VALUES = [0, 1, 2, 3, 4, 5, 6] as const;
export type Weekday = (typeof WEEKDAY_VALUES)[number];
