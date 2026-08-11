/**
 * Operational email helpers (normalize + light format check).
 * Not a full RFC 5322 implementation.
 */

const BASIC_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmailFormat(email: string): boolean {
  if (!email || email.length > 320) {
    return false;
  }
  return BASIC_EMAIL.test(email);
}
