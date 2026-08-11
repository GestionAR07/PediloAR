export const DELIVERY_PROVIDERS = ["MERCHANT", "PLATFORM"] as const;
export type DeliveryProvider = (typeof DELIVERY_PROVIDERS)[number];

export const DELIVERY_STATUSES = [
  "PENDING",
  "REQUESTED",
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
  "FAILED",
  "CANCELED",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
