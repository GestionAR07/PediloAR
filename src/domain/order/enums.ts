export const ORDER_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const FULFILLMENT_METHODS = [
  "PICKUP",
  "MERCHANT_DELIVERY",
  "PLATFORM_DELIVERY",
] as const;
export type FulfillmentMethod = (typeof FULFILLMENT_METHODS)[number];

export const ORDER_ACTOR_TYPES = [
  "CUSTOMER",
  "MERCHANT_USER",
  "ADMIN",
  "SYSTEM",
] as const;
export type OrderActorType = (typeof ORDER_ACTOR_TYPES)[number];

export const CANCEL_REASONS = [
  "CUSTOMER_REQUEST",
  "MERCHANT_UNAVAILABLE",
  "OUT_OF_STOCK",
  "PAYMENT_ISSUE",
  "OTHER",
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];
