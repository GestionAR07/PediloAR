import { describe, expect, it } from "vitest";
import {
  getPublicOptionGroupModeLabel,
  getPublicQuantitySelectionSummary,
} from "./public-option-copy";

describe("public option copy", () => {
  it("uses customer-friendly mode labels", () => {
    expect(getPublicOptionGroupModeLabel("SINGLE")).toBe("Elegí una opción");
    expect(getPublicOptionGroupModeLabel("MULTIPLE")).toBe("Elegí varias");
    expect(getPublicOptionGroupModeLabel("QUANTITY")).toBe("Variedades");
  });

  it("explains fixed QUANTITY dozen without raw min/max jargon", () => {
    expect(getPublicQuantitySelectionSummary(12, 12)).toBe(
      "Elegí 12 unidades entre estas variedades.",
    );
  });
});
