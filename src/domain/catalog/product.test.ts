import { describe, expect, it } from "vitest";
import { moneyCents } from "../money/money-cents";
import { DomainError } from "../shared/errors";
import {
  assertProduct,
  isProductOperationallyAvailable,
  isProductSellable,
} from "./product";
import type { Product } from "./types";

function baseProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod_1",
    merchantId: "merch_1",
    merchantCategoryId: "mcat_1",
    name: "Empanada",
    description: "Clásica",
    priceCents: moneyCents(80000),
    active: true,
    available: true,
    stockMode: "NOT_TRACKED",
    stockQuantity: null,
    sortOrder: 0,
    imagePath: null,
    ...overrides,
  };
}

describe("product", () => {
  it("allows NOT_TRACKED without stock quantity", () => {
    expect(() => assertProduct(baseProduct())).not.toThrow();
    expect(isProductSellable(baseProduct())).toBe(true);
  });

  it("requires non-negative stock for TRACKED", () => {
    expect(() =>
      assertProduct(baseProduct({ stockMode: "TRACKED", stockQuantity: null })),
    ).toThrow(DomainError);

    expect(() =>
      assertProduct(baseProduct({ stockMode: "TRACKED", stockQuantity: -1 })),
    ).toThrow(DomainError);

    expect(() =>
      assertProduct(baseProduct({ stockMode: "TRACKED", stockQuantity: 3 })),
    ).not.toThrow();
  });

  it("available=false disables selling even with stock", () => {
    expect(
      isProductSellable(
        baseProduct({
          stockMode: "TRACKED",
          stockQuantity: 5,
          available: false,
        }),
      ),
    ).toBe(false);
  });

  it("TRACKED with zero stock is not sellable", () => {
    expect(
      isProductSellable(
        baseProduct({ stockMode: "TRACKED", stockQuantity: 0 }),
      ),
    ).toBe(false);
  });

  it("active=false is not operationally available", () => {
    expect(
      isProductOperationallyAvailable(baseProduct({ active: false })),
    ).toBe(false);
  });

  it("NOT_TRACKED with available=true is operationally available", () => {
    expect(isProductOperationallyAvailable(baseProduct())).toBe(true);
  });

  it("TRACKED with stock and available=true is operationally available", () => {
    expect(
      isProductOperationallyAvailable(
        baseProduct({ stockMode: "TRACKED", stockQuantity: 5 }),
      ),
    ).toBe(true);
  });

  it("TRACKED with stock=0 and available=true is not operationally available", () => {
    expect(
      isProductOperationallyAvailable(
        baseProduct({
          stockMode: "TRACKED",
          stockQuantity: 0,
          available: true,
        }),
      ),
    ).toBe(false);
  });

  it("TRACKED with stock but available=false is not operationally available", () => {
    expect(
      isProductOperationallyAvailable(
        baseProduct({
          stockMode: "TRACKED",
          stockQuantity: 10,
          available: false,
        }),
      ),
    ).toBe(false);
  });

  it("rejects empty name and negative price", () => {
    expect(() => assertProduct(baseProduct({ name: "  " }))).toThrow(
      DomainError,
    );
    expect(() =>
      assertProduct(baseProduct({ priceCents: -1 as never })),
    ).toThrow(DomainError);
  });
});
