import { DomainError } from "../shared/errors";
import type { MerchantOpeningInterval } from "./types";
import { WEEKDAY_VALUES, type Weekday } from "./enums";

const MINUTES_PER_DAY = 24 * 60;

export function isWeekday(value: number): value is Weekday {
  return (WEEKDAY_VALUES as readonly number[]).includes(value);
}

export function assertOpeningInterval(
  interval: Pick<
    MerchantOpeningInterval,
    "weekday" | "openMinute" | "closeMinute"
  >,
): void {
  if (!isWeekday(interval.weekday)) {
    throw new DomainError("HOURS_INVALID_WEEKDAY", "Invalid weekday");
  }

  if (
    !Number.isInteger(interval.openMinute) ||
    !Number.isInteger(interval.closeMinute)
  ) {
    throw new DomainError(
      "HOURS_INVALID_MINUTES",
      "Opening minutes must be integers",
    );
  }

  if (
    interval.openMinute < 0 ||
    interval.openMinute >= MINUTES_PER_DAY ||
    interval.closeMinute <= 0 ||
    interval.closeMinute > MINUTES_PER_DAY
  ) {
    throw new DomainError(
      "HOURS_OUT_OF_RANGE",
      "Opening interval must stay within a local day",
    );
  }

  if (interval.closeMinute <= interval.openMinute) {
    throw new DomainError(
      "HOURS_INVALID_RANGE",
      "closeMinute must be greater than openMinute",
    );
  }
}

/**
 * Returns whether a local-day minute falls inside any interval for that weekday.
 * Caller must convert "now" using the city's timezone — never the browser TZ.
 */
export function isOpenAtLocalMinute(
  intervals: readonly MerchantOpeningInterval[],
  weekday: Weekday,
  localMinute: number,
): boolean {
  if (
    !Number.isInteger(localMinute) ||
    localMinute < 0 ||
    localMinute >= MINUTES_PER_DAY
  ) {
    throw new DomainError(
      "HOURS_INVALID_QUERY",
      "localMinute must be an integer in [0, 1440)",
    );
  }

  return intervals.some(
    (interval) =>
      interval.weekday === weekday &&
      localMinute >= interval.openMinute &&
      localMinute < interval.closeMinute,
  );
}
