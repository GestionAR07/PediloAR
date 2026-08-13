import { DomainError } from "../shared/errors";
import { err, ok, type Result } from "../shared/result";

export const CUSTOMER_NAME_SNAPSHOT_MAX_LENGTH = 80;
export const CUSTOMER_PHONE_SNAPSHOT_MAX_LENGTH = 32;
export const MERCHANT_NAME_SNAPSHOT_MAX_LENGTH = 160;

const PHONE_ALLOWED_CHARS = /^[+0-9()\s-]+$/;
const MIN_PHONE_DIGITS = 8;
const MAX_PHONE_DIGITS = 15;

function countDigits(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

export function parseCustomerNameSnapshot(
  raw: string,
): Result<string, DomainError> {
  if (typeof raw !== "string") {
    return err(
      new DomainError(
        "CUSTOMER_NAME_INVALID",
        "Customer name must be a string",
      ),
    );
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return err(
      new DomainError("CUSTOMER_NAME_EMPTY", "Customer name is required"),
    );
  }

  if (trimmed.length > CUSTOMER_NAME_SNAPSHOT_MAX_LENGTH) {
    return err(
      new DomainError(
        "CUSTOMER_NAME_TOO_LONG",
        `Customer name must be at most ${CUSTOMER_NAME_SNAPSHOT_MAX_LENGTH} characters`,
      ),
    );
  }

  return ok(trimmed);
}

/**
 * Validates presented phone text without stripping +54, 0, hyphens, or spaces.
 * This is checkout persistence validation, not a canonical E.164 normalizer.
 */
export function parseCustomerPhoneSnapshot(
  raw: string,
): Result<string, DomainError> {
  if (typeof raw !== "string") {
    return err(
      new DomainError(
        "CUSTOMER_PHONE_INVALID",
        "Customer phone must be a string",
      ),
    );
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return err(
      new DomainError("CUSTOMER_PHONE_EMPTY", "Customer phone is required"),
    );
  }

  if (trimmed.length > CUSTOMER_PHONE_SNAPSHOT_MAX_LENGTH) {
    return err(
      new DomainError(
        "CUSTOMER_PHONE_TOO_LONG",
        `Customer phone must be at most ${CUSTOMER_PHONE_SNAPSHOT_MAX_LENGTH} characters`,
      ),
    );
  }

  if (!PHONE_ALLOWED_CHARS.test(trimmed)) {
    return err(
      new DomainError(
        "CUSTOMER_PHONE_INVALID_CHARS",
        "Customer phone may only contain digits, spaces, hyphens, parentheses, and a leading +",
      ),
    );
  }

  if (trimmed.includes("+") && !trimmed.startsWith("+")) {
    return err(
      new DomainError(
        "CUSTOMER_PHONE_INVALID_PLUS",
        "The + sign may only appear at the start of the phone number",
      ),
    );
  }

  const digits = countDigits(trimmed);
  if (digits < MIN_PHONE_DIGITS || digits > MAX_PHONE_DIGITS) {
    return err(
      new DomainError(
        "CUSTOMER_PHONE_DIGIT_COUNT",
        "Customer phone must contain between 8 and 15 digits",
      ),
    );
  }

  return ok(trimmed);
}

/**
 * Server-side merchant display name frozen onto the order.
 * Callers must pass merchants.name from persistence — never a browser field.
 */
export function snapshotMerchantName(
  merchantName: string,
): Result<string, DomainError> {
  if (typeof merchantName !== "string") {
    return err(
      new DomainError(
        "MERCHANT_NAME_SNAPSHOT_INVALID",
        "Merchant name snapshot must be a string",
      ),
    );
  }

  const trimmed = merchantName.trim();
  if (!trimmed) {
    return err(
      new DomainError(
        "MERCHANT_NAME_SNAPSHOT_EMPTY",
        "Merchant name snapshot is required",
      ),
    );
  }

  if (trimmed.length > MERCHANT_NAME_SNAPSHOT_MAX_LENGTH) {
    return err(
      new DomainError(
        "MERCHANT_NAME_SNAPSHOT_TOO_LONG",
        `Merchant name snapshot must be at most ${MERCHANT_NAME_SNAPSHOT_MAX_LENGTH} characters`,
      ),
    );
  }

  return ok(trimmed);
}
