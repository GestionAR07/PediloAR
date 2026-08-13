import { moneyCents } from "@/domain/money/money-cents";
import { buildConfigurationSignature } from "./configuration-signature";
import { calculateConfiguredUnitPriceCents } from "./pricing";
import {
  emptyCart,
  isCartEmpty,
  type Cart,
  type CartGroupConfiguration,
  type CartLine,
} from "./types";

export type AddToCartInput = {
  merchantId: string;
  merchantNameSnapshot: string;
  productId: string;
  productNameSnapshot: string;
  basePriceCents: number;
  configuration: CartGroupConfiguration[];
  /** Initial line quantity (usually 1). */
  quantity?: number;
  /** TRACKED stock UX cap for the sellable product package. */
  stockCap?: number | null;
  createLineId: () => string;
};

export type AddToCartResult =
  | { ok: true; cart: Cart; merged: boolean }
  | { ok: false; reason: "merchant_conflict"; cart: Cart }
  | { ok: false; reason: "invalid_quantity" };

export function addProductToCart(
  cart: Cart,
  input: AddToCartInput,
): AddToCartResult {
  const quantity = input.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, reason: "invalid_quantity" };
  }

  if (
    !isCartEmpty(cart) &&
    cart.merchantId !== "" &&
    cart.merchantId !== input.merchantId
  ) {
    return { ok: false, reason: "merchant_conflict", cart };
  }

  const signature = buildConfigurationSignature(
    input.productId,
    input.configuration,
  );
  const unitPrice = calculateConfiguredUnitPriceCents(
    input.basePriceCents,
    input.configuration,
  );

  const next: Cart = isCartEmpty(cart)
    ? {
        version: 1,
        merchantId: input.merchantId,
        merchantNameSnapshot: input.merchantNameSnapshot,
        lines: [],
      }
    : {
        ...cart,
        merchantId: input.merchantId,
        merchantNameSnapshot: input.merchantNameSnapshot,
        lines: [...cart.lines],
      };

  const existingIndex = next.lines.findIndex(
    (line) =>
      line.productId === input.productId &&
      line.configurationSignature === signature,
  );

  const stockCap =
    input.stockCap != null && Number.isInteger(input.stockCap)
      ? Math.max(0, input.stockCap)
      : null;

  if (existingIndex >= 0) {
    const existing = next.lines[existingIndex]!;
    let nextQuantity = existing.quantity + quantity;
    if (stockCap != null) {
      nextQuantity = Math.min(
        nextQuantity,
        Math.max(stockCap, existing.quantity),
      );
      if (stockCap < 1) {
        nextQuantity = existing.quantity;
      }
    }
    next.lines[existingIndex] = {
      ...existing,
      quantity: nextQuantity,
      unitPriceCentsSnapshot: unitPrice,
      productNameSnapshot: input.productNameSnapshot,
      basePriceCentsSnapshot: moneyCents(input.basePriceCents),
      configuration: input.configuration,
    };
    return { ok: true, cart: next, merged: true };
  }

  let lineQuantity = quantity;
  if (stockCap != null) {
    if (stockCap < 1) {
      return { ok: false, reason: "invalid_quantity" };
    }
    lineQuantity = Math.min(lineQuantity, stockCap);
  }

  const line: CartLine = {
    id: input.createLineId(),
    productId: input.productId,
    productNameSnapshot: input.productNameSnapshot,
    basePriceCentsSnapshot: moneyCents(input.basePriceCents),
    quantity: lineQuantity,
    configuration: input.configuration,
    unitPriceCentsSnapshot: unitPrice,
    configurationSignature: signature,
  };
  next.lines.push(line);
  return { ok: true, cart: next, merged: false };
}

export function replaceCartWithProduct(input: AddToCartInput): AddToCartResult {
  return addProductToCart(emptyCart(), input);
}

export function setCartLineQuantity(
  cart: Cart,
  lineId: string,
  quantity: number,
  stockCap: number | null = null,
): Cart {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return removeCartLine(cart, lineId);
  }

  let capped = quantity;
  if (stockCap != null && Number.isInteger(stockCap) && stockCap >= 0) {
    if (stockCap < 1) {
      return removeCartLine(cart, lineId);
    }
    capped = Math.min(capped, stockCap);
  }

  return {
    ...cart,
    lines: cart.lines.map((line) =>
      line.id === lineId ? { ...line, quantity: capped } : line,
    ),
  };
}

export function removeCartLine(cart: Cart, lineId: string): Cart {
  const lines = cart.lines.filter((line) => line.id !== lineId);
  if (lines.length === 0) {
    return emptyCart();
  }
  return { ...cart, lines };
}

export function clearCart(): Cart {
  return emptyCart();
}

/** Max line quantity for TRACKED stock UX (null = no client cap). */
export function resolveStockCap(
  stockMode: string,
  stockQuantity: number | null | undefined,
): number | null {
  if (stockMode !== "TRACKED") {
    return null;
  }
  if (stockQuantity == null || !Number.isInteger(stockQuantity)) {
    return null;
  }
  return Math.max(0, stockQuantity);
}
