/**
 * Formats an absolute instant in a city IANA timezone for merchant-facing copy.
 */
export function formatInstantAsLocalTime(
  instant: Date,
  timezone: string,
): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instant);
}

function partValue(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  return Number(parts.find((part) => part.type === type)?.value);
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const asUtc = Date.UTC(
    partValue(parts, "year"),
    partValue(parts, "month") - 1,
    partValue(parts, "day"),
    partValue(parts, "hour"),
    partValue(parts, "minute"),
    partValue(parts, "second"),
  );
  return asUtc - date.getTime();
}

/**
 * Start of the civil day in `timeZone`, as a UTC Date.
 * Used so "hoy" for terminals follows the merchant city, not UTC.
 */
export function startOfLocalDay(now: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const localMidnightAsUtc = Date.UTC(
    partValue(parts, "year"),
    partValue(parts, "month") - 1,
    partValue(parts, "day"),
    0,
    0,
    0,
    0,
  );
  const probe = new Date(localMidnightAsUtc);
  return new Date(localMidnightAsUtc - timeZoneOffsetMs(probe, timeZone));
}

export function formatMerchantOrderWhen(
  createdAt: Date,
  now: Date,
  timeZone: string,
): { ageLabel: string; clockLabel: string } {
  const clockLabel = formatInstantAsLocalTime(createdAt, timeZone);
  const elapsedMs = Math.max(0, now.getTime() - createdAt.getTime());
  const elapsedMinutes = Math.floor(elapsedMs / 60_000);
  if (elapsedMinutes < 1) {
    return { ageLabel: "Hace un momento", clockLabel };
  }
  if (elapsedMinutes < 60) {
    return { ageLabel: `Hace ${elapsedMinutes} min`, clockLabel };
  }
  return { ageLabel: clockLabel, clockLabel };
}
