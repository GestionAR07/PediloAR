import { describe, expect, it, vi } from "vitest";
import {
  DELETE_BLOCKED_BY_OPEN_ORDERS_MESSAGE,
  PRODUCT_HAS_OPEN_ORDERS,
  STOCK_MODE_BLOCKED_BY_OPEN_ORDERS_MESSAGE,
} from "@/domain/catalog/open-order-integrity";
import type { OrderStatus } from "@/domain/order/enums";
import { isOrderNonTerminalStatus } from "@/domain/order/transitions";
import { AuthzError } from "@/server/auth/errors";
import {
  createProduct,
  deleteProduct,
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
  imagePath: null,
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
    productHasOpenNonTerminalOrders: vi.fn(async () => false),
    deleteProduct: vi.fn(async () => ({ id: PROD_A })),
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

  it("does not auto-toggle available when stock changes", async () => {
    const deps = baseDeps({
      findProductById: vi.fn(async () => ({
        ...existingProduct,
        stockMode: "TRACKED",
        stockQuantity: 5,
        available: true,
      })),
    });
    const result = await updateProduct(
      MERCHANT_A,
      PROD_A,
      { stockQuantity: 0 },
      deps,
    );
    expect(result.ok).toBe(true);
    expect(deps.updateProduct).toHaveBeenCalledWith(
      MERCHANT_A,
      PROD_A,
      expect.not.objectContaining({ available: expect.anything() }),
    );
  });
});

const OPEN_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY",
] as const satisfies readonly OrderStatus[];

const TERMINAL_STATUSES = [
  "COMPLETED",
  "CANCELED",
] as const satisfies readonly OrderStatus[];

const MERCHANT_B = "99999999-9999-4999-8999-999999999999";

function depsWithOrders(
  rows: Array<{ merchantId: string; productId: string; status: OrderStatus }>,
  overrides: Partial<ProductDeps> = {},
): ProductDeps {
  return baseDeps({
    findProductById: vi.fn(async (merchantId, productId) => {
      if (merchantId !== MERCHANT_A || productId !== PROD_A) {
        return null;
      }
      return {
        ...existingProduct,
        stockMode: "TRACKED",
        stockQuantity: 5,
      };
    }),
    productHasOpenNonTerminalOrders: vi.fn(async (merchantId, productId) =>
      rows.some(
        (row) =>
          row.merchantId === merchantId &&
          row.productId === productId &&
          isOrderNonTerminalStatus(row.status),
      ),
    ),
    ...overrides,
  });
}

describe("updateProduct open-order stock integrity", () => {
  for (const status of OPEN_STATUSES) {
    it(`rejects stock_mode change when an Order is ${status}`, async () => {
      const deps = depsWithOrders([
        { merchantId: MERCHANT_A, productId: PROD_A, status },
      ]);
      const result = await updateProduct(
        MERCHANT_A,
        PROD_A,
        { stockMode: "NOT_TRACKED" },
        deps,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(PRODUCT_HAS_OPEN_ORDERS);
        expect(result.error.message).toBe(
          STOCK_MODE_BLOCKED_BY_OPEN_ORDERS_MESSAGE,
        );
      }
      expect(deps.updateProduct).not.toHaveBeenCalled();
    });
  }

  for (const status of TERMINAL_STATUSES) {
    it(`allows stock_mode change when Orders are only ${status}`, async () => {
      const deps = depsWithOrders([
        { merchantId: MERCHANT_A, productId: PROD_A, status },
      ]);
      const result = await updateProduct(
        MERCHANT_A,
        PROD_A,
        { stockMode: "NOT_TRACKED" },
        deps,
      );
      expect(result.ok).toBe(true);
      expect(deps.updateProduct).toHaveBeenCalled();
    });
  }

  it("allows available=false while an Order is open", async () => {
    const deps = depsWithOrders([
      { merchantId: MERCHANT_A, productId: PROD_A, status: "PENDING" },
    ]);
    const result = await updateProduct(
      MERCHANT_A,
      PROD_A,
      { available: false },
      deps,
    );
    expect(result.ok).toBe(true);
    expect(deps.productHasOpenNonTerminalOrders).not.toHaveBeenCalled();
  });

  it("allows active=false while an Order is open", async () => {
    const deps = depsWithOrders([
      { merchantId: MERCHANT_A, productId: PROD_A, status: "PENDING" },
    ]);
    const result = await updateProduct(
      MERCHANT_A,
      PROD_A,
      { active: false },
      deps,
    );
    expect(result.ok).toBe(true);
    expect(deps.productHasOpenNonTerminalOrders).not.toHaveBeenCalled();
  });

  it("does not run the open-order check when stock_mode is unchanged", async () => {
    const deps = depsWithOrders([
      { merchantId: MERCHANT_A, productId: PROD_A, status: "PENDING" },
    ]);
    const result = await updateProduct(
      MERCHANT_A,
      PROD_A,
      { stockMode: "TRACKED", stockQuantity: 4 },
      deps,
    );
    expect(result.ok).toBe(true);
    expect(deps.productHasOpenNonTerminalOrders).not.toHaveBeenCalled();
    expect(deps.updateProduct).toHaveBeenCalledWith(
      MERCHANT_A,
      PROD_A,
      expect.not.objectContaining({ stockMode: expect.anything() }),
    );
  });

  it("does not leak another merchant's open Orders", async () => {
    const deps = depsWithOrders([
      { merchantId: MERCHANT_B, productId: PROD_A, status: "PENDING" },
    ]);
    const result = await updateProduct(
      MERCHANT_A,
      PROD_A,
      { stockMode: "NOT_TRACKED" },
      deps,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects NOT_TRACKED to TRACKED while an Order is open", async () => {
    const deps = depsWithOrders(
      [{ merchantId: MERCHANT_A, productId: PROD_A, status: "READY" }],
      {
        findProductById: vi.fn(async () => ({
          ...existingProduct,
          stockMode: "NOT_TRACKED",
          stockQuantity: null,
        })),
      },
    );
    const result = await updateProduct(
      MERCHANT_A,
      PROD_A,
      { stockMode: "TRACKED", stockQuantity: 5 },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(PRODUCT_HAS_OPEN_ORDERS);
    }
  });

  it("rejects a foreign-merchant product as not found", async () => {
    const hasOpen = vi.fn(async () => true);
    const deps = baseDeps({
      findProductById: vi.fn(async () => null),
      productHasOpenNonTerminalOrders: hasOpen,
    });
    const result = await updateProduct(
      MERCHANT_A,
      PROD_OTHER,
      { stockMode: "NOT_TRACKED" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PRODUCT_NOT_FOUND");
    }
    expect(hasOpen).not.toHaveBeenCalled();
  });
});

describe("deleteProduct open-order stock integrity", () => {
  it("rejects hard delete while an Order is open", async () => {
    const deps = depsWithOrders([
      { merchantId: MERCHANT_A, productId: PROD_A, status: "PENDING" },
    ]);
    const result = await deleteProduct(MERCHANT_A, PROD_A, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(PRODUCT_HAS_OPEN_ORDERS);
      expect(result.error.message).toBe(DELETE_BLOCKED_BY_OPEN_ORDERS_MESSAGE);
    }
    expect(deps.deleteProduct).not.toHaveBeenCalled();
  });

  it("allows hard delete when Orders are only terminal", async () => {
    const deps = depsWithOrders([
      { merchantId: MERCHANT_A, productId: PROD_A, status: "COMPLETED" },
      { merchantId: MERCHANT_A, productId: PROD_A, status: "CANCELED" },
    ]);
    const result = await deleteProduct(MERCHANT_A, PROD_A, deps);
    expect(result.ok).toBe(true);
    expect(deps.deleteProduct).toHaveBeenCalledWith(MERCHANT_A, PROD_A);
  });

  it("rejects a foreign-merchant product as not found", async () => {
    const hasOpen = vi.fn(async () => true);
    const deps = baseDeps({
      findProductById: vi.fn(async () => null),
      productHasOpenNonTerminalOrders: hasOpen,
    });
    const result = await deleteProduct(MERCHANT_A, PROD_OTHER, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PRODUCT_NOT_FOUND");
    }
    expect(hasOpen).not.toHaveBeenCalled();
    expect(deps.deleteProduct).not.toHaveBeenCalled();
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
