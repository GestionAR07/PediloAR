/**
 * Persist domain enumerations as TEXT + CHECK, not PostgreSQL native ENUMs.
 *
 * Rationale:
 * - Order/Delivery statuses and similar sets will evolve (new values, reorder).
 * - PG ENUM ALTER is awkward (no easy remove/rename/reorder across migrations).
 * - TEXT + CHECK keeps migrations additive (`DROP CHECK` + `ADD CHECK`) and reviewable.
 * - Application still validates with TypeScript unions / domain pure functions.
 *
 * Do not use CHECK enums for free-form user text.
 */
export const MERCHANT_STATUS_VALUES = ["DRAFT", "ACTIVE", "SUSPENDED"] as const;
export const MERCHANT_USER_ROLE_VALUES = ["OWNER", "STAFF"] as const;
export const PAYMENT_METHOD_CODE_VALUES = [
  "CASH",
  "TRANSFER",
  "MERCADO_PAGO",
] as const;
export const PLATFORM_ROLE_VALUES = ["USER", "ADMIN"] as const;
export const USER_PROFILE_STATUS_VALUES = ["ACTIVE", "SUSPENDED"] as const;
export const STOCK_MODE_VALUES = ["NOT_TRACKED", "TRACKED"] as const;
export const OPTION_SELECTION_MODE_VALUES = [
  "SINGLE",
  "MULTIPLE",
  "QUANTITY",
] as const;
export const ORDER_STATUS_VALUES = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELED",
] as const;
export const FULFILLMENT_METHOD_VALUES = [
  "PICKUP",
  "MERCHANT_DELIVERY",
  "PLATFORM_DELIVERY",
] as const;
export const ORDER_ACTOR_TYPE_VALUES = [
  "CUSTOMER",
  "MERCHANT_USER",
  "ADMIN",
  "SYSTEM",
] as const;
export const CANCEL_REASON_VALUES = [
  "CUSTOMER_REQUEST",
  "MERCHANT_UNAVAILABLE",
  "OUT_OF_STOCK",
  "PAYMENT_ISSUE",
  "OTHER",
] as const;
export const DELIVERY_PROVIDER_VALUES = ["MERCHANT", "PLATFORM"] as const;
export const DELIVERY_STATUS_VALUES = [
  "PENDING",
  "REQUESTED",
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
  "FAILED",
  "CANCELED",
] as const;
export const MERCHANT_APPLICATION_STATUS_VALUES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;

export function sqlInList(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(", ");
}
