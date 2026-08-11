import { DomainError } from "../shared/errors";
import { err, ok, type Result } from "../shared/result";
import type { IdempotencyKey } from "../shared/ids";

/**
 * Idempotency keys are client-supplied opaque identifiers.
 *
 * Domain validates shape only. Uniqueness is a persistence concern:
 * Phase 2B will add a UNIQUE constraint on Order.idempotencyKey.
 *
 * Domain does not generate keys and does not lowercase them
 * (UUID and token case must be preserved).
 */
export const IDEMPOTENCY_KEY_MIN_LENGTH = 8;
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

/**
 * Allows common client identifiers: UUID, ULID-like, URL-safe tokens.
 * Case-sensitive; no forced normalization beyond trim.
 */
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._~-]+$/;

export function parseIdempotencyKey(
  raw: string,
): Result<IdempotencyKey, DomainError> {
  if (typeof raw !== "string") {
    return err(
      new DomainError(
        "IDEMPOTENCY_KEY_INVALID",
        "Idempotency key must be a string",
      ),
    );
  }

  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return err(
      new DomainError(
        "IDEMPOTENCY_KEY_EMPTY",
        "Idempotency key cannot be empty or whitespace-only",
      ),
    );
  }

  if (trimmed.length < IDEMPOTENCY_KEY_MIN_LENGTH) {
    return err(
      new DomainError(
        "IDEMPOTENCY_KEY_TOO_SHORT",
        `Idempotency key must be at least ${IDEMPOTENCY_KEY_MIN_LENGTH} characters after trim`,
      ),
    );
  }

  if (trimmed.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    return err(
      new DomainError(
        "IDEMPOTENCY_KEY_TOO_LONG",
        `Idempotency key must be at most ${IDEMPOTENCY_KEY_MAX_LENGTH} characters after trim`,
      ),
    );
  }

  if (!IDEMPOTENCY_KEY_PATTERN.test(trimmed)) {
    return err(
      new DomainError(
        "IDEMPOTENCY_KEY_INVALID_CHARS",
        "Idempotency key may only contain letters, digits, and . _ ~ -",
      ),
    );
  }

  return ok(trimmed as IdempotencyKey);
}

export function assertIdempotencyKey(raw: string): IdempotencyKey {
  const result = parseIdempotencyKey(raw);
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}
