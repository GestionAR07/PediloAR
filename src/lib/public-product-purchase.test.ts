import { describe, expect, it } from "vitest";
import { getPublicProductPurchasePresentation } from "./public-product-purchase";

describe("getPublicProductPurchasePresentation", () => {
  it("hides inactive products", () => {
    expect(
      getPublicProductPurchasePresentation({
        active: false,
        available: true,
        stockMode: "NOT_TRACKED",
        stockQuantity: null,
      }).visible,
    ).toBe(false);
  });

  it("marks NOT_TRACKED available products sellable", () => {
    const result = getPublicProductPurchasePresentation({
      active: true,
      available: true,
      stockMode: "NOT_TRACKED",
      stockQuantity: null,
    });
    expect(result).toEqual({
      visible: true,
      sellable: true,
      statusLabel: null,
    });
  });

  it("shows active + available=false as No disponible", () => {
    const result = getPublicProductPurchasePresentation({
      active: true,
      available: false,
      stockMode: "NOT_TRACKED",
      stockQuantity: null,
    });
    expect(result).toEqual({
      visible: true,
      sellable: false,
      statusLabel: "No disponible",
    });
  });

  it("shows TRACKED stock 0 as Sin stock", () => {
    const result = getPublicProductPurchasePresentation({
      active: true,
      available: true,
      stockMode: "TRACKED",
      stockQuantity: 0,
    });
    expect(result).toEqual({
      visible: true,
      sellable: false,
      statusLabel: "Sin stock",
    });
  });

  it("marks TRACKED stock > 0 sellable", () => {
    const result = getPublicProductPurchasePresentation({
      active: true,
      available: true,
      stockMode: "TRACKED",
      stockQuantity: 3,
    });
    expect(result.sellable).toBe(true);
  });
});
