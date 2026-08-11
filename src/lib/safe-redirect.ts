/**
 * Internal path helpers for post-auth redirects.
 * Never allow open redirects to external hosts.
 */

const FALLBACK_PATH = "/";

/**
 * Accepts only same-origin relative paths starting with a single `/`.
 * Rejects protocol-relative URLs, absolute URLs, and backslash tricks.
 */
export function sanitizeInternalPath(
  raw: string | null | undefined,
  fallback: string = FALLBACK_PATH,
): string {
  if (raw == null) {
    return fallback;
  }

  const value = raw.trim();
  if (!value) {
    return fallback;
  }

  if (!value.startsWith("/")) {
    return fallback;
  }

  // Protocol-relative (//evil.com) or double-slash path abuse
  if (value.startsWith("//")) {
    return fallback;
  }

  if (value.includes("://") || value.includes("\\")) {
    return fallback;
  }

  // Block encoded slashes that could reconstitute // after decode
  if (value.toLowerCase().includes("%2f%2f")) {
    return fallback;
  }

  return value;
}

export function isSafeInternalPath(raw: string | null | undefined): boolean {
  if (raw == null || raw.trim() === "") {
    return false;
  }
  return sanitizeInternalPath(raw, "\0") !== "\0";
}
