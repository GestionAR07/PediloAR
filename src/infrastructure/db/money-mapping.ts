import { customType } from "drizzle-orm/pg-core";
import {
  assertNonNegativeMoneyCents,
  type MoneyCents,
} from "../../domain/money/money-cents";
import { DomainError } from "../../domain/shared/errors";

/**
 * PostgreSQL stores money as BIGINT cents (never float/numeric).
 *
 * Domain MoneyCents is a safe JS number (Number.isSafeInteger).
 * Driver may return string | number | bigint depending on postgres.js config.
 *
 * Mapping rules:
 * - write: validate MoneyCents → decimal string for bigint bind
 * - read: parse → assert NonNegative MoneyCents (throws if > MAX_SAFE_INTEGER)
 *
 * Do not cast large bigint to Number without this guard.
 */
export function moneyCentsToPg(value: MoneyCents): string {
  assertNonNegativeMoneyCents(value);
  return String(value);
}

export function moneyCentsFromPg(value: unknown): MoneyCents {
  if (value === null || value === undefined) {
    throw new DomainError(
      "MONEY_PG_NULL",
      "Expected non-null money cents from PostgreSQL",
    );
  }

  let asNumber: number;
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  const zero = BigInt(0);

  if (typeof value === "bigint") {
    if (value < zero) {
      throw new DomainError(
        "MONEY_NEGATIVE",
        "Money amount cannot be negative for prices and totals",
      );
    }
    if (value > maxSafe) {
      throw new DomainError(
        "MONEY_OVERFLOW",
        "PostgreSQL bigint money exceeds Number.MAX_SAFE_INTEGER; cannot map to MoneyCents",
      );
    }
    asNumber = Number(value);
  } else if (typeof value === "number") {
    asNumber = value;
  } else if (typeof value === "string") {
    if (!/^\d+$/.test(value)) {
      throw new DomainError(
        "MONEY_PG_INVALID",
        "PostgreSQL money string must be a non-negative integer digit sequence",
      );
    }
    const asBig = BigInt(value);
    if (asBig > maxSafe) {
      throw new DomainError(
        "MONEY_OVERFLOW",
        "PostgreSQL bigint money exceeds Number.MAX_SAFE_INTEGER; cannot map to MoneyCents",
      );
    }
    asNumber = Number(asBig);
  } else {
    throw new DomainError(
      "MONEY_PG_INVALID",
      "Unsupported PostgreSQL money driver type",
    );
  }

  return assertNonNegativeMoneyCents(asNumber);
}

/**
 * Drizzle column type: BIGINT ↔ MoneyCents with safe mapping.
 */
export const moneyCentsColumn = customType<{
  data: MoneyCents;
  driverData: string;
}>({
  dataType() {
    return "bigint";
  },
  toDriver(value: MoneyCents): string {
    return moneyCentsToPg(value);
  },
  fromDriver(value: unknown): MoneyCents {
    return moneyCentsFromPg(value);
  },
});
