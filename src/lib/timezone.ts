/**
 * Light IANA timezone validation via Intl (no external timezone DB).
 */

export function isValidIanaTimezone(value: string): boolean {
  const tz = value.trim();
  if (!tz || tz.length > 64) {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
