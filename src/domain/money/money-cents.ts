import { DomainError } from "../shared/errors";

/**
 * Monetary amount in integer minor units (centavos for ARS).
 * Never use floating point for money.
 *
 * Technical bound only: values must remain Number.isSafeInteger.
 * There is no commercial cap (e.g. max order amount) in domain.
 */
export type MoneyCents = number & { readonly __brand: "MoneyCents" };

export function isSafeMoneyInteger(value: number): boolean {
  return Number.isInteger(value) && Number.isSafeInteger(value);
}

export function assertNonNegativeMoneyCents(value: number): MoneyCents {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    throw new DomainError(
      "MONEY_INVALID",
      "Money amount must be a finite number",
    );
  }

  if (!isSafeMoneyInteger(value)) {
    throw new DomainError(
      "MONEY_NOT_INTEGER",
      "Money amount must be a safe integer in cents",
    );
  }

  if (value < 0) {
    throw new DomainError(
      "MONEY_NEGATIVE",
      "Money amount cannot be negative for prices and totals",
    );
  }

  return value as MoneyCents;
}

export function moneyCents(value: number): MoneyCents {
  return assertNonNegativeMoneyCents(value);
}

export function zeroCents(): MoneyCents {
  return 0 as MoneyCents;
}

function assertSafeMoneyResult(value: number, operation: string): MoneyCents {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    throw new DomainError(
      "MONEY_OVERFLOW",
      `Money ${operation} produced a non-finite result`,
    );
  }

  if (!isSafeMoneyInteger(value)) {
    throw new DomainError(
      "MONEY_OVERFLOW",
      `Money ${operation} exceeded Number.MAX_SAFE_INTEGER`,
    );
  }

  if (value < 0) {
    throw new DomainError(
      "MONEY_NEGATIVE",
      "Money amount cannot be negative for prices and totals",
    );
  }

  return value as MoneyCents;
}

export function addMoney(...amounts: MoneyCents[]): MoneyCents {
  let total = 0;
  for (const amount of amounts) {
    assertNonNegativeMoneyCents(amount);
    const next = total + amount;
    if (!Number.isSafeInteger(next)) {
      throw new DomainError(
        "MONEY_OVERFLOW",
        "Money addition exceeded Number.MAX_SAFE_INTEGER",
      );
    }
    total = next;
  }
  return assertSafeMoneyResult(total, "addition");
}

export function multiplyMoney(unit: MoneyCents, quantity: number): MoneyCents {
  assertNonNegativeMoneyCents(unit);

  if (!Number.isInteger(quantity) || !Number.isSafeInteger(quantity)) {
    throw new DomainError(
      "MONEY_INVALID_QUANTITY",
      "Quantity must be a safe integer",
    );
  }

  if (quantity < 0) {
    throw new DomainError(
      "MONEY_NEGATIVE_QUANTITY",
      "Quantity cannot be negative",
    );
  }

  // Guard before JS loses integer precision on large products.
  if (unit > 0 && quantity > 0) {
    const maxFactor = Math.floor(Number.MAX_SAFE_INTEGER / unit);
    if (quantity > maxFactor) {
      throw new DomainError(
        "MONEY_OVERFLOW",
        "Money multiplication exceeded Number.MAX_SAFE_INTEGER",
      );
    }
  }

  return assertSafeMoneyResult(unit * quantity, "multiplication");
}

/**
 * Price deltas on options may be zero or positive in MVP.
 * Negative deltas (discounts on choices) are deferred.
 */
export function assertPriceDeltaCents(value: number): MoneyCents {
  return assertNonNegativeMoneyCents(value);
}
