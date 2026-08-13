import {
  calculateLineTotal,
  calculateOptionsSubtotal,
} from "@/domain/order/totals";
import { moneyCents, type MoneyCents } from "@/domain/money/money-cents";
import type { CartGroupConfiguration, CartLine } from "./types";

export function flattenConfigurationOptions(
  configuration: readonly CartGroupConfiguration[],
): Array<{ priceDeltaCents: MoneyCents; quantity: number }> {
  const options: Array<{ priceDeltaCents: MoneyCents; quantity: number }> = [];
  for (const group of configuration) {
    for (const selection of group.selections) {
      options.push({
        priceDeltaCents: moneyCents(selection.priceDeltaCents),
        quantity: selection.quantity,
      });
    }
  }
  return options;
}

/** Base + option deltas for a single configured product unit. */
export function calculateConfiguredUnitPriceCents(
  basePriceCents: number,
  configuration: readonly CartGroupConfiguration[],
): MoneyCents {
  const options = flattenConfigurationOptions(configuration);
  const optionsPerUnit = calculateOptionsSubtotal(options);
  return moneyCents(basePriceCents + optionsPerUnit);
}

export function calculateCartLineTotalCents(line: CartLine): MoneyCents {
  return calculateLineTotal({
    unitPriceCents: moneyCents(line.basePriceCentsSnapshot),
    quantity: line.quantity,
    options: flattenConfigurationOptions(line.configuration),
  });
}

export function calculateCartTotalCents(
  lines: readonly CartLine[],
): MoneyCents {
  let total = 0;
  for (const line of lines) {
    total += calculateCartLineTotalCents(line);
  }
  return moneyCents(total);
}

/** Sum of cart line quantities (badge = products, not QUANTITY option units). */
export function calculateCartBadgeCount(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
