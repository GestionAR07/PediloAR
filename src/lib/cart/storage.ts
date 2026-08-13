import {
  CART_SCHEMA_VERSION,
  emptyCart,
  type Cart,
  type CartGroupConfiguration,
  type CartLine,
  type CartSelection,
} from "@/domain/cart/types";
import { moneyCents } from "@/domain/money/money-cents";

export const CART_STORAGE_KEY = "marketplace-rawson-cart-v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSelection(value: unknown): CartSelection | null {
  if (!isRecord(value)) return null;
  if (typeof value.choiceId !== "string" || !value.choiceId) return null;
  if (typeof value.choiceName !== "string") return null;
  if (
    typeof value.quantity !== "number" ||
    !Number.isInteger(value.quantity) ||
    value.quantity < 1
  ) {
    return null;
  }
  if (
    typeof value.priceDeltaCents !== "number" ||
    !Number.isInteger(value.priceDeltaCents)
  ) {
    return null;
  }
  return {
    choiceId: value.choiceId,
    choiceName: value.choiceName,
    quantity: value.quantity,
    priceDeltaCents: moneyCents(value.priceDeltaCents),
  };
}

function parseGroup(value: unknown): CartGroupConfiguration | null {
  if (!isRecord(value)) return null;
  if (typeof value.groupId !== "string" || !value.groupId) return null;
  if (typeof value.groupName !== "string") return null;
  if (
    value.selectionMode !== "SINGLE" &&
    value.selectionMode !== "MULTIPLE" &&
    value.selectionMode !== "QUANTITY"
  ) {
    return null;
  }
  if (!Array.isArray(value.selections)) return null;
  const selections: CartSelection[] = [];
  for (const entry of value.selections) {
    const selection = parseSelection(entry);
    if (!selection) return null;
    selections.push(selection);
  }
  return {
    groupId: value.groupId,
    groupName: value.groupName,
    selectionMode: value.selectionMode,
    selections,
  };
}

function parseLine(value: unknown): CartLine | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || !value.id) return null;
  if (typeof value.productId !== "string" || !value.productId) return null;
  if (typeof value.productNameSnapshot !== "string") return null;
  if (
    typeof value.basePriceCentsSnapshot !== "number" ||
    !Number.isInteger(value.basePriceCentsSnapshot) ||
    value.basePriceCentsSnapshot < 0
  ) {
    return null;
  }
  if (
    typeof value.quantity !== "number" ||
    !Number.isInteger(value.quantity) ||
    value.quantity < 1
  ) {
    return null;
  }
  if (!Array.isArray(value.configuration)) return null;
  const configuration: CartGroupConfiguration[] = [];
  for (const entry of value.configuration) {
    const group = parseGroup(entry);
    if (!group) return null;
    configuration.push(group);
  }
  if (
    typeof value.unitPriceCentsSnapshot !== "number" ||
    !Number.isInteger(value.unitPriceCentsSnapshot) ||
    value.unitPriceCentsSnapshot < 0
  ) {
    return null;
  }
  if (typeof value.configurationSignature !== "string") return null;

  // Reject accidental signed URL persistence.
  for (const key of Object.keys(value)) {
    if (
      key.toLowerCase().includes("url") ||
      key === "imageUrl" ||
      key === "signedUrl"
    ) {
      return null;
    }
  }

  return {
    id: value.id,
    productId: value.productId,
    productNameSnapshot: value.productNameSnapshot,
    basePriceCentsSnapshot: moneyCents(value.basePriceCentsSnapshot),
    quantity: value.quantity,
    configuration,
    unitPriceCentsSnapshot: moneyCents(value.unitPriceCentsSnapshot),
    configurationSignature: value.configurationSignature,
  };
}

/**
 * Safely parse cart JSON. Corrupt / wrong version → empty cart (never throws).
 */
export function parseCartJson(raw: string | null | undefined): Cart {
  if (raw == null || raw.trim() === "") {
    return emptyCart();
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return emptyCart();
    if (parsed.version !== CART_SCHEMA_VERSION) return emptyCart();
    if (typeof parsed.merchantId !== "string") return emptyCart();
    if (typeof parsed.merchantNameSnapshot !== "string") return emptyCart();
    if (!Array.isArray(parsed.lines)) return emptyCart();

    if (parsed.merchantId === "" && parsed.lines.length === 0) {
      return emptyCart();
    }

    if (parsed.merchantId === "" && parsed.lines.length > 0) {
      return emptyCart();
    }

    const lines: CartLine[] = [];
    for (const entry of parsed.lines) {
      const line = parseLine(entry);
      if (!line) return emptyCart();
      lines.push(line);
    }

    if (lines.length === 0) {
      return emptyCart();
    }

    return {
      version: CART_SCHEMA_VERSION,
      merchantId: parsed.merchantId,
      merchantNameSnapshot: parsed.merchantNameSnapshot,
      lines,
    };
  } catch {
    return emptyCart();
  }
}

export function serializeCart(cart: Cart): string {
  return JSON.stringify(cart);
}

export function readCartFromLocalStorage(
  storage: Pick<Storage, "getItem"> | null | undefined,
): Cart {
  if (!storage) return emptyCart();
  try {
    return parseCartJson(storage.getItem(CART_STORAGE_KEY));
  } catch {
    return emptyCart();
  }
}

export function writeCartToLocalStorage(
  storage: Pick<Storage, "setItem" | "removeItem"> | null | undefined,
  cart: Cart,
): void {
  if (!storage) return;
  try {
    if (!cart.merchantId || cart.lines.length === 0) {
      storage.removeItem(CART_STORAGE_KEY);
      return;
    }
    storage.setItem(CART_STORAGE_KEY, serializeCart(cart));
  } catch {
    // Quota / private mode — ignore; storefront must keep working.
  }
}
