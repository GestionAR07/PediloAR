import { emptyCart, type Cart } from "@/domain/cart/types";
import {
  readCartFromLocalStorage,
  writeCartToLocalStorage,
} from "@/lib/cart/storage";

let memoryCart: Cart | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function getCartSnapshot(): Cart {
  if (typeof window === "undefined") {
    return emptyCart();
  }
  if (memoryCart == null) {
    memoryCart = readCartFromLocalStorage(window.localStorage);
  }
  return memoryCart;
}

export function getServerCartSnapshot(): Cart {
  return emptyCart();
}

export function subscribeCart(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setCartSnapshot(next: Cart): void {
  memoryCart = next;
  if (typeof window !== "undefined") {
    writeCartToLocalStorage(window.localStorage, next);
  }
  emit();
}
