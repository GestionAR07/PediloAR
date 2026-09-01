import { isOpenAtLocalMinute } from "@/domain/merchant/hours";
import type { MerchantOpeningInterval } from "@/domain/merchant/types";
import {
  formatLocalMinuteAsClock,
  getLocalWeekdayAndMinute,
  type LocalWeekdayMinute,
} from "@/lib/local-weekday";

export type PublicHoursPresentation = {
  label: string;
  detail: string | null;
};

/**
 * Open/closed according to configured intervals in the merchant city timezone.
 *
 * `unknown` when there are no intervals, or when IANA conversion cannot be
 * resolved — callers must not invent open/closed in those cases.
 */
export type MerchantHoursOpenState = "open" | "closed" | "unknown";

type ResolvedMerchantHours =
  | { state: "unknown"; local: null }
  | { state: "open" | "closed"; local: LocalWeekdayMinute };

function resolveMerchantHoursOpenNow(input: {
  intervals: readonly MerchantOpeningInterval[];
  timezone: string;
  now: Date;
}): ResolvedMerchantHours {
  if (input.intervals.length === 0) {
    return { state: "unknown", local: null };
  }

  const local = getLocalWeekdayAndMinute(input.now, input.timezone);
  if (!local) {
    return { state: "unknown", local: null };
  }

  const openNow = isOpenAtLocalMinute(
    input.intervals,
    local.weekday,
    local.localMinute,
  );
  return { state: openNow ? "open" : "closed", local };
}

export function getMerchantHoursOpenState(input: {
  intervals: readonly MerchantOpeningInterval[];
  timezone: string;
  now: Date;
}): MerchantHoursOpenState {
  return resolveMerchantHoursOpenNow(input).state;
}

/**
 * Honest hours presentation. If intervals are missing or timezone conversion
 * fails, returns null (neutral — do not invent open/closed).
 */
export function getPublicHoursPresentation(input: {
  intervals: readonly MerchantOpeningInterval[];
  timezone: string;
  now: Date;
}): PublicHoursPresentation | null {
  const resolved = resolveMerchantHoursOpenNow(input);
  if (resolved.state === "unknown") {
    return null;
  }

  if (resolved.state === "open") {
    return { label: "Abierto", detail: null };
  }

  const nextOpen = input.intervals
    .filter((interval) => interval.weekday === resolved.local.weekday)
    .filter((interval) => interval.openMinute > resolved.local.localMinute)
    .sort((a, b) => a.openMinute - b.openMinute)[0];

  if (nextOpen) {
    return {
      label: "Cerrado",
      detail: `Abre a las ${formatLocalMinuteAsClock(nextOpen.openMinute)}`,
    };
  }

  return { label: "Cerrado", detail: null };
}
