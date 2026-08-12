import { describe, expect, it, vi } from "vitest";
import { AuthzError } from "@/server/auth/errors";
import {
  createProduct,
  toggleProductAvailability,
  updateProduct,
  type ProductDeps,
} from "./products";

const MERCHANT_A = "11111111-1111-4111-8111-111111111111";
const CAT_A = "22222222-2222-4222-8222-222222222222";
const CAT_INACTIVE = "66666666-6666-4666-8666-666666666666";
const PROD_A = "33333333-3333-4333-8333-333333333333";
const CAT_OTHER = "77777777-7777-4777-8777-777777777777";
const PROD_OTHER = "88888888-8888-4888-8888-888888888888";

const existingProduct = {
  id: PROD_A,
  merchantCategoryId: CAT_A,
  name: "Empanada carne",
  description: "",
  priceCents: 250000,
  active: true,
  available: true,
  stockMode: "NOT_TRACKED",
  stockQuantity: null,
  sortOrder: 0,
};

function categoryLookup(id: string): { id: string; active: boolean } | null {
  if (id === CAT_A) {
    return { id: CAT_A, active: true };
  }
  if (id === CAT_INACTIVE) {
    return { id: CAT_INACTIVE, active: false };
  }
  return null;
}

function baseDeps(overrides: Partial<ProductDeps> = {}): ProductDeps {
  return {
    requireCatalogAccess: vi.fn(async () => undefined),
    findMerchantCategoryById: vi.fn(async (_m, id) => categoryLookup(id)),
    findProductById: vi.fn(async () => existingProduct),
    nextProductSortOrder: vi.fn(async () => 0),
    insertProduct: vi.fn(async () => ({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    })),
    updateProduct: vi.fn(async () => ({ id: PROD_A })),
    setProductAvailability: vi.fn(async () => ({
      id: PROD_A,
      available: false,
    })),
    ...overrides,
  };
}

const createInput = {
  name: "Empanada",
  priceInput: "2500",
  stockMode: "NOT_TRACKED",
};

describe("createProduct", () => {
  it("creates product with active category", async () => {
    const deps = baseDeps();
    const result = await createProduct(
      MERCHANT_A,
      { ...createInput, merchantCategoryId: CAT_A },
      deps,
    );
    expect(result.ok).toBe(true);
  });

  it("creates NOT_TRACKED product with parsed price", async () => {
    const deps = baseDeps();
    const result = await createProduct(
      MERCHANT_A,
      {
        merchantCategoryId: CAT_A,
        name: "Empanada",
        priceInput: "2500",
        stockMode: "NOT_TRACKED",
      },
      deps,
    );
    expect(result.ok).toBe(true);
    expect(deps.insertProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        priceCents: 250000,
        stockMode: "NOT_TRACKED",
        stockQuantity: null,
      }),
    );
  });

  it("rejects inactive category on create", async () => {
    const result = await createProduct(
      MERCHANT_A,
      { ...createInput, merchantCategoryId: CAT_INACTIVE },
      baseDeps(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CATEGORY_INACTIVE");
    }
  });

  it("creates TRACKED product with stock >= 0", async () => {
    const result = await createProduct(
      MERCHANT_A,
      {
        merchantCategoryId: CAT_A,
        name: "Coca Cola",
        priceInput: "1500",
        stockMode: "TRACKED",
        stockQuantity: 10,
      },
      baseDeps(),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects invalid price", async () => {
    const result = await createProduct(
      MERCHANT_A,
      {
        merchantCategoryId: CAT_A,
        name: "X",
        priceInput: "abc",
        stockMode: "NOT_TRACKED",
      },
      baseDeps(),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects category from another merchant scope", async () => {
    const deps = baseDeps({
      findMerchantCategoryById: vi.fn(async () => null),
    });
    const result = await createProduct(
      MERCHANT_A,
      {
        merchantCategoryId: CAT_OTHER,
        name: "X",
        priceInput: "100",
        stockMode: "NOT_TRACKED",
      },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CATEGORY_NOT_FOUND");
    }
  });

  it("rejects TRACKED without valid stock", async () => {
    const result = await createProduct(
      MERCHANT_A,
      {
        merchantCategoryId: CAT_A,
        name: "X",
        priceInput: "100",
        stockMode: "TRACKED",
        stockQuantity: -1,
      },
      baseDeps(),
    );
    expect(result.ok).toBe(false);
  });
});

describe("updateProduct category assignment", () => {
  it("allows edit while keeping inactive current category", async () => {
    const deps = baseDeps({
      findProductById: vi.fn(async () => ({
        ...existingProduct,
        merchantCategoryId: CAT_INACTIVE,
      })),
    });
    const result = await updateProduct(
      MERCHANT_A,
      PROD_A,
      {
        merchantCategoryId: CAT_INACTIVE,
        name: "Empanada carne",
      },
      deps,
    );
    expect(result.ok).toBe(true);
  });

  it("allows moving product from inactive to active category", async () => {
    const deps = baseDeps({
      findProductById: vi.fn(async () => ({
        ...existingProduct,
        merchantCategoryId: CAT_INACTIVE,
      })),
    });
    const result = await updateProduct(
      MERCHANT_A,
      PROD_A,
      { merchantCategoryId: CAT_A },
      deps,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects moving product to another inactive category", async () => {
    const deps = baseDeps({
      findProductById: vi.fn(async () => ({
        ...existingProduct,
        merchantCategoryId: CAT_A,
      })),
      findMerchantCategoryById: vi.fn(async (_m, id) => {
        if (id === CAT_A) {
          return { id: CAT_A, active: true };
        }
        if (id === CAT_INACTIVE) {
          return { id: CAT_INACTIVE, active: false };
        }
        return null;
      }),
    });
    const result = await updateProduct(
      MERCHANT_A,
      PROD_A,
      { merchantCategoryId: CAT_INACTIVE },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CATEGORY_INACTIVE");
    }
  });

  it("rejects when product not in merchant scope", async () => {
    const deps = baseDeps({
      findProductById: vi.fn(async () => null),
    });
    const result = await updateProduct(
      MERCHANT_A,
      PROD_OTHER,
      { name: "Hack" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PRODUCT_NOT_FOUND");
    }
  });

  it("rejects category injection from another merchant", async () => {
    const deps = baseDeps({
      findMerchantCategoryById: vi.fn(async (_m, id) =>
        id === CAT_A ? { id: CAT_A, active: true } : null,
      ),
    });
    const result = await updateProduct(
      MERCHANT_A,
      PROD_A,
      { merchantCategoryId: CAT_OTHER },
      deps,
    );
    expect(result.ok).toBe(false);
  });
});

describe("toggleProductAvailability", () => {
  it("toggles available flag in one step", async () => {
    const deps = baseDeps({
      setProductAvailability: vi.fn(async () => ({
        id: PROD_A,
        available: false,
      })),
    });
    const result = await toggleProductAvailability(MERCHANT_A, PROD_A, deps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.available).toBe(false);
    }
  });

  it("requires membership", async () => {
    const deps = baseDeps({
      requireCatalogAccess: vi.fn(async () => {
        throw new AuthzError("NOT_MERCHANT_MEMBER", "no");
      }),
    });
    await expect(
      toggleProductAvailability(MERCHANT_A, PROD_A, deps),
    ).rejects.toBeInstanceOf(AuthzError);
  });
});
