import { describe, expect, it } from "vitest";
import {
  defaultBoundsForNewOptionGroup,
  getOptionModePresentation,
  OPTION_MODE_PRESENTATIONS,
} from "./option-mode-presentation";

describe("getOptionModePresentation", () => {
  it("maps SINGLE to merchant-friendly copy", () => {
    expect(getOptionModePresentation("SINGLE").label).toBe("Elegir una opción");
  });

  it("maps MULTIPLE to merchant-friendly copy", () => {
    expect(getOptionModePresentation("MULTIPLE").label).toBe("Elegir varias");
  });

  it("maps QUANTITY to merchant-friendly copy", () => {
    expect(getOptionModePresentation("QUANTITY").label).toBe(
      "Variedades por unidad",
    );
  });
});

describe("defaultBoundsForNewOptionGroup", () => {
  it("uses 1/1 for new SINGLE groups", () => {
    expect(defaultBoundsForNewOptionGroup("SINGLE")).toEqual({
      minSelections: 1,
      maxSelections: 1,
    });
  });

  it("uses 0/10 for new MULTIPLE groups", () => {
    expect(defaultBoundsForNewOptionGroup("MULTIPLE")).toEqual({
      minSelections: 0,
      maxSelections: 10,
    });
  });

  it("uses 1/24 for new QUANTITY groups", () => {
    expect(defaultBoundsForNewOptionGroup("QUANTITY")).toEqual({
      minSelections: 1,
      maxSelections: 24,
    });
  });
});

describe("OPTION_MODE_PRESENTATIONS", () => {
  it("does not expose internal enum names as primary labels", () => {
    for (const mode of OPTION_MODE_PRESENTATIONS) {
      expect(mode.label).not.toMatch(/SINGLE|MULTIPLE|QUANTITY/);
    }
  });
});
