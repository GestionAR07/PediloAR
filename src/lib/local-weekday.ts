import type { Weekday } from "@/domain/merchant/enums";

export type LocalWeekdayMinute = {
  weekday: Weekday;
  localMinute: number;
};

const WEEKDAY_MAP: Record<string, Weekday> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Converts an absolute instant to local weekday + minute via IANA timezone.
 * Returns null when timezone/parts cannot be resolved safely.
 */
export function getLocalWeekdayAndMinute(
  instant: Date,
  timeZone: string,
): LocalWeekdayMinute | null {
  if (!timeZone.trim()) {
    return null;
  }

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant);

    const weekdayRaw = parts.find((p) => p.type === "weekday")?.value;
    const hourRaw = parts.find((p) => p.type === "hour")?.value;
    const minuteRaw = parts.find((p) => p.type === "minute")?.value;

    if (!weekdayRaw || hourRaw == null || minuteRaw == null) {
      return null;
    }

    const weekday = WEEKDAY_MAP[weekdayRaw];
    if (weekday === undefined) {
      return null;
    }

    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (
      !Number.isInteger(hour) ||
      !Number.isInteger(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return null;
    }

    return { weekday, localMinute: hour * 60 + minute };
  } catch {
    return null;
  }
}

export function formatLocalMinuteAsClock(localMinute: number): string {
  const hour = Math.floor(localMinute / 60);
  const minute = localMinute % 60;
  return `${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}`;
}
