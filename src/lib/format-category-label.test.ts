import { describe, expect, it } from "vitest";
import { formatMerchantCategoryLabel } from "./format-category-label";

describe("formatMerchantCategoryLabel", () => {
  it("returns plain name for active categories", () => {
    expect(formatMerchantCategoryLabel("Empanadas", true)).toBe("Empanadas");
  });

  it("marks inactive categories for admin UI", () => {
    expect(formatMerchantCategoryLabel("Bebidas", false)).toBe(
      "Bebidas (inactiva)",
    );
  });
});
