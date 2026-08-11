import { describe, expect, it } from "vitest";
import {
  assertIdempotencyKey,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  IDEMPOTENCY_KEY_MIN_LENGTH,
  parseIdempotencyKey,
} from "./idempotency";

describe("idempotency key", () => {
  it("trims and accepts UUID-like keys without lowercasing", () => {
    const raw = "  AbCdef12-3456-7890-ABCD-EF1234567890  ";
    const result = parseIdempotencyKey(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("AbCdef12-3456-7890-ABCD-EF1234567890");
      expect(result.value).not.toBe(result.value.toLowerCase());
    }
  });

  it("accepts secure tokens with _ . ~ -", () => {
    const key = "tok_Secure.Value~v1-xyz";
    expect(assertIdempotencyKey(key)).toBe(key);
  });

  it("rejects empty and whitespace-only", () => {
    const empty = parseIdempotencyKey("");
    const spaces = parseIdempotencyKey("   ");
    expect(empty.ok).toBe(false);
    expect(spaces.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.error.code).toBe("IDEMPOTENCY_KEY_EMPTY");
    }
    if (!spaces.ok) {
      expect(spaces.error.code).toBe("IDEMPOTENCY_KEY_EMPTY");
    }
  });

  it("rejects too short after trim", () => {
    const result = parseIdempotencyKey("abc");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("IDEMPOTENCY_KEY_TOO_SHORT");
    }
  });

  it("rejects too long", () => {
    const result = parseIdempotencyKey(
      "a".repeat(IDEMPOTENCY_KEY_MAX_LENGTH + 1),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("IDEMPOTENCY_KEY_TOO_LONG");
    }
  });

  it("rejects invalid characters", () => {
    const result = parseIdempotencyKey("has space!!");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("IDEMPOTENCY_KEY_INVALID_CHARS");
    }
  });

  it("accepts minimum length boundary", () => {
    const key = "a".repeat(IDEMPOTENCY_KEY_MIN_LENGTH);
    expect(assertIdempotencyKey(key)).toBe(key);
  });
});
