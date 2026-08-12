import type { MerchantStatus } from "./enums";

export type MerchantOperationalFields = {
  status: MerchantStatus;
  acceptingOrders: boolean;
  pausedUntil: Date | null;
};

export type MerchantOperationalStatus =
  "ACCEPTING" | "TEMPORARILY_PAUSED" | "MANUALLY_PAUSED" | "NOT_ACTIVE";

export const TEMPORARY_PAUSE_DURATIONS_MINUTES = [15, 30, 60] as const;
export type TemporaryPauseDurationMinutes =
  (typeof TEMPORARY_PAUSE_DURATIONS_MINUTES)[number];

/**
 * Whether the merchant can accept new orders right now.
 * Does not consider hours, product stock, or delivery zones.
 */
export function isMerchantOperationallyAcceptingOrders(
  merchant: MerchantOperationalFields,
  now: Date,
): boolean {
  if (merchant.status !== "ACTIVE") {
    return false;
  }

  if (!merchant.acceptingOrders) {
    return false;
  }

  if (merchant.pausedUntil !== null && merchant.pausedUntil > now) {
    return false;
  }

  return true;
}

export function getMerchantOperationalStatus(
  merchant: MerchantOperationalFields,
  now: Date,
): MerchantOperationalStatus {
  if (merchant.status !== "ACTIVE") {
    return "NOT_ACTIVE";
  }

  if (!merchant.acceptingOrders) {
    return "MANUALLY_PAUSED";
  }

  if (merchant.pausedUntil !== null && merchant.pausedUntil > now) {
    return "TEMPORARILY_PAUSED";
  }

  return "ACCEPTING";
}

export function addMinutesToInstant(now: Date, minutes: number): Date {
  return new Date(now.getTime() + minutes * 60_000);
}

export function isTemporaryPauseDurationMinutes(
  value: number,
): value is TemporaryPauseDurationMinutes {
  return TEMPORARY_PAUSE_DURATIONS_MINUTES.includes(
    value as TemporaryPauseDurationMinutes,
  );
}
