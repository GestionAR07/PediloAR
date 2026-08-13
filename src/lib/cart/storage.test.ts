import { describe, expect, it } from "vitest";
import { emptyCart, type Cart } from "@/domain/cart/types";
import { moneyCents } from "@/domain/money/money-cents";
import {
  CART_STORAGE_KEY,
  parseCartJson,
  readCartFromLocalStorage,
  serializeCart,
  writeCartToLocalStorage,
} from "./storage";

function sampleCart(): Cart {
  return {
    version: 1,
    merchantId: "m1",
    merchantNameSnapshot: "Comercio",
    lines: [
      {
        id: "l1",
        productId: "p1",
        productNameSnapshot: "Producto",
        basePriceCentsSnapshot: moneyCents(1000),
        quantity: 2,
        configuration: [],
        unitPriceCentsSnapshot: moneyCents(1000),
        configurationSignature: "p1|",
      },
    ],
  };
}

describe("cart localStorage hydrate", () => {
  it("hydrates a valid cart", () => {
    const cart = parseCartJson(serializeCart(sampleCart()));
    expect(cart.merchantId).toBe("m1");
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]?.quantity).toBe(2);
  });

  it("resets invalid JSON without throwing", () => {
    expect(parseCartJson("{not-json")).toEqual(emptyCart());
    expect(parseCartJson("null")).toEqual(emptyCart());
    expect(parseCartJson("")).toEqual(emptyCart());
  });

  it("resets invalid schema/version", () => {
    expect(
      parseCartJson(
        JSON.stringify({
          version: 99,
          merchantId: "m1",
          merchantNameSnapshot: "X",
          lines: [],
        }),
      ),
    ).toEqual(emptyCart());
  });

  it("treats empty cart as empty", () => {
    expect(parseCartJson(serializeCart(emptyCart()))).toEqual(emptyCart());
  });

  it("rejects carts that persist signed URL fields", () => {
    const raw = JSON.stringify({
      version: 1,
      merchantId: "m1",
      merchantNameSnapshot: "X",
      lines: [
        {
          id: "l1",
          productId: "p1",
          productNameSnapshot: "P",
          basePriceCentsSnapshot: 100,
          quantity: 1,
          configuration: [],
          unitPriceCentsSnapshot: 100,
          configurationSignature: "p1|",
          imageUrl: "https://signed.example/x",
        },
      ],
    });
    expect(parseCartJson(raw)).toEqual(emptyCart());
  });

  it("reads and writes through a Storage-like adapter without SSR", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    };

    expect(readCartFromLocalStorage(null)).toEqual(emptyCart());
    writeCartToLocalStorage(storage, sampleCart());
    expect(memory.get(CART_STORAGE_KEY)).toContain("merchantId");
    expect(readCartFromLocalStorage(storage).lines[0]?.quantity).toBe(2);
    writeCartToLocalStorage(storage, emptyCart());
    expect(memory.has(CART_STORAGE_KEY)).toBe(false);
  });
});
