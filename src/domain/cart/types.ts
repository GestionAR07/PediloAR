import type { MoneyCents } from "@/domain/money/money-cents";
import type { OptionSelectionMode } from "@/domain/catalog/enums";

export const CART_SCHEMA_VERSION = 1 as const;

export type CartSelection = {
  choiceId: string;
  choiceName: string;
  quantity: number;
  priceDeltaCents: MoneyCents;
};

export type CartGroupConfiguration = {
  groupId: string;
  groupName: string;
  selectionMode: OptionSelectionMode;
  selections: CartSelection[];
};

export type CartLine = {
  id: string;
  productId: string;
  productNameSnapshot: string;
  basePriceCentsSnapshot: MoneyCents;
  quantity: number;
  configuration: CartGroupConfiguration[];
  /** Configured unit price (base + option deltas for one unit). */
  unitPriceCentsSnapshot: MoneyCents;
  /** Deterministic identity of productId + configuration. */
  configurationSignature: string;
};

export type Cart = {
  version: typeof CART_SCHEMA_VERSION;
  merchantId: string;
  merchantNameSnapshot: string;
  lines: CartLine[];
};

export function emptyCart(): Cart {
  return {
    version: CART_SCHEMA_VERSION,
    merchantId: "",
    merchantNameSnapshot: "",
    lines: [],
  };
}

export function isCartEmpty(cart: Cart): boolean {
  return !cart.merchantId || cart.lines.length === 0;
}
