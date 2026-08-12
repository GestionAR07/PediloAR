import { isOpenAtLocalMinute } from "@/domain/merchant/hours";
import type { MerchantOpeningInterval } from "@/domain/merchant/types";
import {
  formatLocalMinuteAsClock,
  getLocalWeekdayAndMinute,
} from "@/lib/local-weekday";

export type PublicHoursPresentation = {
  label: string;
  detail: string | null;
};

/**
 * Honest hours presentation. If intervals are missing or timezone conversion
 * fails, returns null (neutral — do not invent open/closed).
 */
export function getPublicHoursPresentation(input: {
  intervals: readonly MerchantOpeningInterval[];
  timezone: string;
  now: Date;
}): PublicHoursPresentation | null {
  if (input.intervals.length === 0) {
    return null;
  }

  const local = getLocalWeekdayAndMinute(input.now, input.timezone);
  if (!local) {
    return null;
  }

  const openNow = isOpenAtLocalMinute(
    input.intervals,
    local.weekday,
    local.localMinute,
  );

  if (openNow) {
    return { label: "Abierto", detail: null };
  }

  const nextOpen = input.intervals
    .filter((interval) => interval.weekday === local.weekday)
    .filter((interval) => interval.openMinute > local.localMinute)
    .sort((a, b) => a.openMinute - b.openMinute)[0];

  if (nextOpen) {
    return {
      label: "Cerrado",
      detail: `Abre a las ${formatLocalMinuteAsClock(nextOpen.openMinute)}`,
    };
  }

  return { label: "Cerrado", detail: null };
}
