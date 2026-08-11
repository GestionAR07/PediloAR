import { describe, expect, it } from "vitest";
import { moneyCents } from "../money/money-cents";
import { DomainError } from "../shared/errors";
import { assertOptionGroup, assertOptionSelections } from "./options";
import type { ProductOptionChoice, ProductOptionGroup } from "./types";

function group(
  overrides: Partial<ProductOptionGroup> = {},
): ProductOptionGroup {
  return {
    id: "grp_1",
    productId: "prod_1",
    name: "Tamaño",
    selectionMode: "SINGLE",
    minSelections: 1,
    maxSelections: 1,
    sortOrder: 0,
    active: true,
    ...overrides,
  };
}

function choices(names: string[], groupId = "grp_1"): ProductOptionChoice[] {
  return names.map((name, index) => ({
    id: `ch_${index}`,
    groupId,
    name,
    priceDeltaCents: moneyCents(index * 100),
    sortOrder: index,
    active: true,
  }));
}

describe("option groups", () => {
  it("validates SINGLE selection", () => {
    const g = group();
    const c = choices(["Chico", "Grande"]);
    expect(() =>
      assertOptionSelections(g, c, [{ choiceId: "ch_1", quantity: 1 }]),
    ).not.toThrow();

    expect(() =>
      assertOptionSelections(g, c, [
        { choiceId: "ch_0", quantity: 1 },
        { choiceId: "ch_1", quantity: 1 },
      ]),
    ).toThrow(DomainError);
  });

  it("validates MULTIPLE selection", () => {
    const g = group({
      name: "Extras",
      selectionMode: "MULTIPLE",
      minSelections: 0,
      maxSelections: 3,
    });
    const c = choices(["Queso", "Bacon", "Cebolla"]);

    expect(() =>
      assertOptionSelections(g, c, [
        { choiceId: "ch_0", quantity: 1 },
        { choiceId: "ch_1", quantity: 1 },
      ]),
    ).not.toThrow();

    expect(() =>
      assertOptionSelections(g, c, [{ choiceId: "ch_0", quantity: 2 }]),
    ).toThrow(DomainError);
  });

  it("validates QUANTITY totals for empanada-style packs", () => {
    const g = group({
      name: "Variedades",
      selectionMode: "QUANTITY",
      minSelections: 12,
      maxSelections: 12,
    });
    const c = choices(["Carne", "Jamón y queso", "Verdura"]);

    expect(() =>
      assertOptionSelections(g, c, [
        { choiceId: "ch_0", quantity: 4 },
        { choiceId: "ch_1", quantity: 3 },
        { choiceId: "ch_2", quantity: 5 },
      ]),
    ).not.toThrow();

    expect(() =>
      assertOptionSelections(g, c, [
        { choiceId: "ch_0", quantity: 4 },
        { choiceId: "ch_1", quantity: 3 },
      ]),
    ).toThrow(DomainError);
  });

  it("rejects invalid group bounds and inactive choices", () => {
    expect(() =>
      assertOptionGroup(group({ minSelections: 2, maxSelections: 1 })),
    ).toThrow(DomainError);

    const g = group({
      selectionMode: "MULTIPLE",
      minSelections: 1,
      maxSelections: 2,
    });
    const inactive = choices(["Queso"]).map((choice) => ({
      ...choice,
      active: false,
    }));

    expect(() =>
      assertOptionSelections(g, inactive, [{ choiceId: "ch_0", quantity: 1 }]),
    ).toThrow(DomainError);
  });
});
