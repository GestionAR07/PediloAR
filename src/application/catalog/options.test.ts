import { describe, expect, it, vi } from "vitest";
import {
  createOptionChoice,
  createOptionGroup,
  updateOptionChoice,
  type OptionDeps,
} from "./options";

const MERCHANT_A = "11111111-1111-4111-8111-111111111111";
const PROD_A = "33333333-3333-4333-8333-333333333333";
const GROUP_A = "44444444-4444-4444-8444-444444444444";
const CHOICE_A = "55555555-5555-4555-8555-555555555555";
const PROD_OTHER = "88888888-8888-4888-8888-888888888888";
const GROUP_OTHER = "99999999-9999-4999-8999-999999999999";
const CHOICE_OTHER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function baseDeps(overrides: Partial<OptionDeps> = {}): OptionDeps {
  return {
    requireCatalogAccess: vi.fn(async () => undefined),
    findProductById: vi.fn(async () => ({ id: PROD_A })),
    findOptionGroupById: vi.fn(async () => ({
      id: GROUP_A,
      productId: PROD_A,
      name: "Tamaño",
      selectionMode: "SINGLE",
      minSelections: 0,
      maxSelections: 1,
      sortOrder: 0,
      active: true,
    })),
    findOptionChoiceById: vi.fn(async () => ({
      id: CHOICE_A,
      groupId: GROUP_A,
    })),
    nextOptionGroupSortOrder: vi.fn(async () => 0),
    nextOptionChoiceSortOrder: vi.fn(async () => 0),
    insertOptionGroup: vi.fn(async () => ({ id: GROUP_A })),
    updateOptionGroup: vi.fn(async () => ({ id: GROUP_A })),
    insertOptionChoice: vi.fn(async () => ({ id: CHOICE_A })),
    updateOptionChoice: vi.fn(async () => ({ id: CHOICE_A })),
    ...overrides,
  };
}

describe("createOptionGroup modes", () => {
  it("creates SINGLE group", async () => {
    const deps = baseDeps();
    const result = await createOptionGroup(
      MERCHANT_A,
      { productId: PROD_A, name: "Tamaño", selectionMode: "SINGLE" },
      deps,
    );
    expect(result.ok).toBe(true);
    expect(deps.insertOptionGroup).toHaveBeenCalledWith(
      expect.objectContaining({ selectionMode: "SINGLE" }),
    );
  });

  it("creates MULTIPLE group", async () => {
    const result = await createOptionGroup(
      MERCHANT_A,
      { productId: PROD_A, name: "Extras", selectionMode: "MULTIPLE" },
      baseDeps(),
    );
    expect(result.ok).toBe(true);
  });

  it("creates QUANTITY group", async () => {
    const result = await createOptionGroup(
      MERCHANT_A,
      { productId: PROD_A, name: "Sabores", selectionMode: "QUANTITY" },
      baseDeps(),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects product outside merchant scope", async () => {
    const deps = baseDeps({
      findProductById: vi.fn(async () => null),
    });
    const result = await createOptionGroup(
      MERCHANT_A,
      { productId: PROD_OTHER, name: "X", selectionMode: "SINGLE" },
      deps,
    );
    expect(result.ok).toBe(false);
  });
});

describe("createOptionChoice", () => {
  it("stores price delta in cents", async () => {
    const deps = baseDeps();
    const result = await createOptionChoice(
      MERCHANT_A,
      {
        groupId: GROUP_A,
        name: "Grande",
        priceDeltaInput: "2000",
      },
      deps,
    );
    expect(result.ok).toBe(true);
    expect(deps.insertOptionChoice).toHaveBeenCalledWith(
      expect.objectContaining({ priceDeltaCents: 200000 }),
    );
  });

  it("rejects group from another merchant", async () => {
    const deps = baseDeps({
      findOptionGroupById: vi.fn(async () => null),
    });
    const result = await createOptionChoice(
      MERCHANT_A,
      { groupId: GROUP_OTHER, name: "X" },
      deps,
    );
    expect(result.ok).toBe(false);
  });
});

describe("updateOptionChoice cross injection", () => {
  it("rejects unknown choice in merchant scope", async () => {
    const deps = baseDeps({
      findOptionChoiceById: vi.fn(async () => null),
    });
    const result = await updateOptionChoice(
      MERCHANT_A,
      CHOICE_OTHER,
      { name: "Hack" },
      deps,
    );
    expect(result.ok).toBe(false);
  });
});
