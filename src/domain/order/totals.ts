import {
  addMoney,
  assertNonNegativeMoneyCents,
  moneyCents,
  multiplyMoney,
  type MoneyCents,
  zeroCents,
} from "../money/money-cents";
import { DomainError } from "../shared/errors";

export type TotalsOptionInput = {
  priceDeltaCents: MoneyCents;
  quantity: number;
};

export type TotalsLineInput = {
  unitPriceCents: MoneyCents;
  quantity: number;
  options: readonly TotalsOptionInput[];
};

export type OrderTotals = {
  itemSubtotalCents: MoneyCents;
  optionsSubtotalCents: MoneyCents;
  orderSubtotalCents: MoneyCents;
  deliveryFeeCents: MoneyCents;
  totalCents: MoneyCents;
};

function assertPositiveLineQuantity(quantity: number): void {
  if (
    !Number.isInteger(quantity) ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1
  ) {
    throw new DomainError(
      "TOTALS_INVALID_QUANTITY",
      "Line quantity must be a positive safe integer",
    );
  }
}

export function calculateOptionsSubtotal(
  options: readonly TotalsOptionInput[],
): MoneyCents {
  let subtotal = zeroCents();

  for (const option of options) {
    assertNonNegativeMoneyCents(option.priceDeltaCents);
    assertPositiveLineQuantity(option.quantity);
    subtotal = addMoney(
      subtotal,
      multiplyMoney(option.priceDeltaCents, option.quantity),
    );
  }

  return subtotal;
}

/**
 * Line total = (unit price + per-unit options subtotal) * line quantity.
 * Option quantities inside QUANTITY groups are already expanded in the option rows.
 * For MULTIPLE/SINGLE, option.quantity is typically 1 per selected choice per unit.
 *
 * Convention used here:
 * - `options` describe one unit of the product.
 * - The line multiplies (unit + options-per-unit) by `quantity`.
 */
export function calculateLineTotal(line: TotalsLineInput): MoneyCents {
  assertNonNegativeMoneyCents(line.unitPriceCents);
  assertPositiveLineQuantity(line.quantity);

  const optionsPerUnit = calculateOptionsSubtotal(line.options);
  const unitWithOptions = addMoney(line.unitPriceCents, optionsPerUnit);
  return multiplyMoney(unitWithOptions, line.quantity);
}

export function calculateOrderTotals(
  lines: readonly TotalsLineInput[],
  deliveryFeeCents: MoneyCents = moneyCents(0),
): OrderTotals {
  assertNonNegativeMoneyCents(deliveryFeeCents);

  let itemSubtotal = zeroCents();
  let optionsSubtotal = zeroCents();

  for (const line of lines) {
    assertNonNegativeMoneyCents(line.unitPriceCents);
    assertPositiveLineQuantity(line.quantity);

    const optionsPerUnit = calculateOptionsSubtotal(line.options);
    itemSubtotal = addMoney(
      itemSubtotal,
      multiplyMoney(line.unitPriceCents, line.quantity),
    );
    optionsSubtotal = addMoney(
      optionsSubtotal,
      multiplyMoney(optionsPerUnit, line.quantity),
    );
  }

  const orderSubtotal = addMoney(itemSubtotal, optionsSubtotal);
  const total = addMoney(orderSubtotal, deliveryFeeCents);

  return {
    itemSubtotalCents: itemSubtotal,
    optionsSubtotalCents: optionsSubtotal,
    orderSubtotalCents: orderSubtotal,
    deliveryFeeCents,
    totalCents: total,
  };
}
