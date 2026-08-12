import { describe, expect, it, vi } from "vitest";
import { AuthzError } from "@/server/auth/errors";
import {
  createMerchantCategory,
  deleteMerchantCategory,
  reorderMerchantCategory,
  updateMerchantCategory,
  type CategoryDeps,
} from "./categories";

function baseDeps(overrides: Partial<CategoryDeps> = {}): CategoryDeps {
  return {
    requireCatalogAccess: vi.fn(async () => undefined),
    findMerchantCategoryById: vi.fn(async () => ({
      id: "cat-1",
      name: "Empanadas",
      sortOrder: 0,
      active: true,
    })),
    countProductsInCategory: vi.fn(async () => 0),
    nextCategorySortOrder: vi.fn(async () => 1),
    insertMerchantCategory: vi.fn(async () => ({ id: "cat-new" })),
    updateMerchantCategory: vi.fn(async () => ({ id: "cat-1" })),
    deleteMerchantCategory: vi.fn(async () => true),
    swapCategorySortOrder: vi.fn(async () => true),
    isUniqueViolation: () => false,
    ...overrides,
  };
}

describe("createMerchantCategory", () => {
  it("creates a valid category", async () => {
    const deps = baseDeps();
    const result = await createMerchantCategory(
      "merchant-a",
      { name: "Empanadas" },
      deps,
    );
    expect(result.ok).toBe(true);
    expect(deps.requireCatalogAccess).toHaveBeenCalledWith("merchant-a");
  });

  it("rejects empty name", async () => {
    const result = await createMerchantCategory(
      "merchant-a",
      { name: "  " },
      baseDeps(),
    );
    expect(result.ok).toBe(false);
  });

  it("maps duplicate name to friendly error", async () => {
    const deps = baseDeps({
      isUniqueViolation: () => true,
      insertMerchantCategory: vi.fn(async () => {
        throw new Error("23505");
      }),
    });
    const result = await createMerchantCategory(
      "merchant-a",
      { name: "Empanadas" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DUPLICATE_CATEGORY");
    }
  });

  it("requires catalog access", async () => {
    const deps = baseDeps({
      requireCatalogAccess: vi.fn(async () => {
        throw new AuthzError("NOT_MERCHANT_MEMBER", "no");
      }),
    });
    await expect(
      createMerchantCategory("merchant-b", { name: "X" }, deps),
    ).rejects.toBeInstanceOf(AuthzError);
  });
});

describe("updateMerchantCategory cross-merchant", () => {
  it("rejects when category not found in merchant scope", async () => {
    const deps = baseDeps({
      findMerchantCategoryById: vi.fn(async () => null),
    });
    const result = await updateMerchantCategory(
      "merchant-a",
      "cat-other",
      { name: "X" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CATEGORY_NOT_FOUND");
    }
  });

  it("deactivating category does not cascade to products", async () => {
    const updateMerchantCategoryMock = vi.fn(async () => ({ id: "cat-1" }));
    const deps = baseDeps({
      updateMerchantCategory: updateMerchantCategoryMock,
    });
    const result = await updateMerchantCategory(
      "merchant-a",
      "cat-1",
      { active: false },
      deps,
    );
    expect(result.ok).toBe(true);
    expect(updateMerchantCategoryMock).toHaveBeenCalledWith(
      "merchant-a",
      "cat-1",
      { active: false },
    );
    expect(updateMerchantCategoryMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ name: expect.anything() }),
    );
  });
});

describe("reorderMerchantCategory", () => {
  it("reorders when swap succeeds", async () => {
    const result = await reorderMerchantCategory(
      "merchant-a",
      "cat-1",
      "up",
      baseDeps(),
    );
    expect(result.ok).toBe(true);
  });
});

describe("deleteMerchantCategory", () => {
  it("blocks delete when category has products", async () => {
    const deps = baseDeps({
      countProductsInCategory: vi.fn(async () => 2),
    });
    const result = await deleteMerchantCategory("merchant-a", "cat-1", deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CATEGORY_HAS_PRODUCTS");
    }
  });
});
