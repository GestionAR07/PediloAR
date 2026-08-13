import { afterEach, describe, expect, it } from "vitest";
import { addProductToCart, clearCart } from "@/domain/cart/cart-operations";
import { moneyCents } from "@/domain/money/money-cents";
import { emptyCart } from "@/domain/cart/types";
import {
  EMPTY_CART,
  getCartSnapshot,
  getServerCartSnapshot,
  resetCartStoreForTests,
  setCartSnapshot,
} from "./cart-store";
import { CART_STORAGE_KEY } from "./storage";

function installLocalStorageMock(): Map<string, string> {
  const memory = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: { localStorage },
  });
  return memory;
}

afterEach(() => {
  resetCartStoreForTests();
  Reflect.deleteProperty(globalThis, "window");
});

describe("cart store snapshot stability", () => {
  it("returns a referentially stable server snapshot", () => {
    const a = getServerCartSnapshot();
    const b = getServerCartSnapshot();
    expect(Object.is(a, b)).toBe(true);
    expect(Object.is(a, EMPTY_CART)).toBe(true);
  });

  it("returns the same client snapshot when nothing changed", () => {
    installLocalStorageMock();
    const a = getCartSnapshot();
    const b = getCartSnapshot();
    expect(Object.is(a, b)).toBe(true);
  });

  it("changes snapshot on add and keeps the new reference stable", () => {
    installLocalStorageMock();
    const before = getCartSnapshot();
    const added = addProductToCart(before, {
      merchantId: "m1",
      merchantNameSnapshot: "Comercio",
      productId: "p1",
      productNameSnapshot: "Producto",
      basePriceCents: 1000,
      configuration: [],
      createLineId: () => "line-1",
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    setCartSnapshot(added.cart);
    const afterAdd = getCartSnapshot();
    expect(Object.is(afterAdd, before)).toBe(false);
    expect(afterAdd.lines).toHaveLength(1);

    const again = getCartSnapshot();
    expect(Object.is(again, afterAdd)).toBe(true);
  });

  it("hydrates from localStorage only once until mutated", () => {
    const memory = installLocalStorageMock();
    memory.set(
      CART_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        merchantId: "m1",
        merchantNameSnapshot: "Comercio",
        lines: [
          {
            id: "l1",
            productId: "p1",
            productNameSnapshot: "Producto",
            basePriceCentsSnapshot: 1000,
            quantity: 1,
            configuration: [],
            unitPriceCentsSnapshot: 1000,
            configurationSignature: "p1|",
          },
        ],
      }),
    );

    const hydrated = getCartSnapshot();
    expect(hydrated.merchantId).toBe("m1");
    expect(hydrated.lines).toHaveLength(1);
    expect(Object.is(getCartSnapshot(), hydrated)).toBe(true);

    memory.set(CART_STORAGE_KEY, JSON.stringify(emptyCart()));
    expect(Object.is(getCartSnapshot(), hydrated)).toBe(true);
  });

  it("uses the stable empty snapshot for invalid localStorage", () => {
    const memory = installLocalStorageMock();
    memory.set(CART_STORAGE_KEY, "{not-json");
    const snapshot = getCartSnapshot();
    expect(Object.is(snapshot, EMPTY_CART)).toBe(true);
    expect(Object.is(getCartSnapshot(), EMPTY_CART)).toBe(true);
  });

  it("does not regress clear to a stable empty snapshot", () => {
    installLocalStorageMock();
    setCartSnapshot({
      version: 1,
      merchantId: "m1",
      merchantNameSnapshot: "Comercio",
      lines: [
        {
          id: "l1",
          productId: "p1",
          productNameSnapshot: "Producto",
          basePriceCentsSnapshot: moneyCents(1000),
          quantity: 1,
          configuration: [],
          unitPriceCentsSnapshot: moneyCents(1000),
          configurationSignature: "p1|",
        },
      ],
    });
    setCartSnapshot(clearCart());
    expect(Object.is(getCartSnapshot(), EMPTY_CART)).toBe(true);
  });
});
