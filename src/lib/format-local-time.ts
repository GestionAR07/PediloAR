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
