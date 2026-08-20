import { describe, expect, it } from "vitest";
import {
  hashMarketplaceCategoryId,
  marketplaceCategoryIconKind,
  marketplaceCategoryPalette,
  normalizeMarketplaceCategoryKey,
} from "./public-marketplace-category-visual";

describe("public marketplace category visual mapping", () => {
  it("maps known slugs and accented names without inventing data", () => {
    expect(marketplaceCategoryIconKind({ slug: "pizza", name: "Pizza" })).toBe(
      "pizza",
    );
    expect(
      marketplaceCategoryIconKind({
        slug: "hamburguesas",
        name: "Hamburguesas",
      }),
    ).toBe("burger");
    expect(
      marketplaceCategoryIconKind({ slug: "farmacia", name: "Farmacia" }),
    ).toBe("pharmacy");
    expect(
      marketplaceCategoryIconKind({ slug: "almacen", name: "Almacén" }),
    ).toBe("grocery");
    expect(
      marketplaceCategoryIconKind({ slug: "custom", name: "Almacén" }),
    ).toBe("grocery");
    expect(normalizeMarketplaceCategoryKey("Panadería")).toBe("panaderia");
  });

  it("falls back to store for unknown categories without throwing", () => {
    expect(
      marketplaceCategoryIconKind({
        slug: "categoria-nueva-xyz",
        name: "Categoría nueva XYZ",
      }),
    ).toBe("store");
  });

  it("picks a stable Pedilo palette from the category id", () => {
    const id = "33333333-3333-4333-8333-333333333333";
    expect(marketplaceCategoryPalette(id)).toBe(marketplaceCategoryPalette(id));
    expect(hashMarketplaceCategoryId(id)).toBe(hashMarketplaceCategoryId(id));
    expect(["violet", "orange", "cyan", "green", "amber", "rose"]).toContain(
      marketplaceCategoryPalette(id),
    );
  });
});
