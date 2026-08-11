import { DomainError } from "../shared/errors";

/**
 * Monetary amount in integer minor units (centavos for ARS).
 * Never use floating point for money.
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

export function addMoney(...amounts: MoneyCents[]): MoneyCents {
  let total = 0;
  for (const amount of amounts) {
    assertNonNegativeMoneyCents(amount);
    total += amount;
  }
  return assertNonNegativeMoneyCents(total);
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

  return assertNonNegativeMoneyCents(unit * quantity);
}

/**
 * Price deltas on options may be zero or positive in MVP.
 * Negative deltas (discounts on choices) are deferred.
 */
export function assertPriceDeltaCents(value: number): MoneyCents {
  return assertNonNegativeMoneyCents(value);
}
