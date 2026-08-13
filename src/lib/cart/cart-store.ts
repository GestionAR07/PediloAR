import {
  CART_SCHEMA_VERSION,
  isCartEmpty,
  type Cart,
} from "@/domain/cart/types";
import {
  readCartFromLocalStorage,
  writeCartToLocalStorage,
} from "@/lib/cart/storage";

/**
 * Referentially stable empty cart for SSR / useSyncExternalStore.
 * Must never be mutated in place.
 */
export const EMPTY_CART: Cart = {
  version: CART_SCHEMA_VERSION,
  merchantId: "",
  merchantNameSnapshot: "",
  lines: [],
};

let memoryCart: Cart | null = null;
let hydratedFromStorage = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function normalizeCart(cart: Cart): Cart {
  return isCartEmpty(cart) ? EMPTY_CART : cart;
}

/** Test / isolation helper — not used by production UI. */
export function resetCartStoreForTests(): void {
  memoryCart = null;
  hydratedFromStorage = false;
}

export function getCartSnapshot(): Cart {
  if (typeof window === "undefined") {
    return EMPTY_CART;
  }
  if (!hydratedFromStorage) {
    memoryCart = normalizeCart(readCartFromLocalStorage(window.localStorage));
    hydratedFromStorage = true;
  }
  return memoryCart ?? EMPTY_CART;
}

export function getServerCartSnapshot(): Cart {
  return EMPTY_CART;
}

export function subscribeCart(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setCartSnapshot(next: Cart): void {
  const normalized = normalizeCart(next);
  if (Object.is(memoryCart, normalized)) {
    return;
  }
  memoryCart = normalized;
  hydratedFromStorage = true;
  if (typeof window !== "undefined") {
    writeCartToLocalStorage(window.localStorage, normalized);
  }
  emit();
}
