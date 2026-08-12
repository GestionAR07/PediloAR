import {
  assertProduct,
  assertProductStock,
  isProductSellable,
} from "@/domain/catalog/product";
import type { StockMode } from "@/domain/catalog/enums";
import { STOCK_MODES } from "@/domain/catalog/enums";
import { moneyCents } from "@/domain/money/money-cents";
import { DomainError } from "@/domain/shared/errors";
import { err, ok, type Result } from "@/domain/shared/result";
import { parseMoneyInputToCents } from "@/lib/parse-money";
import { isValidUuid } from "@/lib/uuid";
import type { CatalogApplicationError, CatalogAuthDeps } from "./types";

export type ProductDeps = CatalogAuthDeps & {
  findMerchantCategoryById: (
    merchantId: string,
    categoryId: string,
  ) => Promise<{ id: string } | null>;
  findProductById: (
    merchantId: string,
    productId: string,
  ) => Promise<{
    id: string;
    merchantCategoryId: string;
    name: string;
    description: string;
    priceCents: number;
    active: boolean;
    available: boolean;
    stockMode: string;
    stockQuantity: number | null;
    sortOrder: number;
  } | null>;
  nextProductSortOrder: (
    merchantId: string,
    categoryId: string,
  ) => Promise<number>;
  insertProduct: (input: {
    merchantId: string;
    merchantCategoryId: string;
    name: string;
    description: string;
    priceCents: number;
    active: boolean;
    available: boolean;
    stockMode: string;
    stockQuantity: number | null;
    sortOrder: number;
  }) => Promise<{ id: string }>;
  updateProduct: (
    merchantId: string,
    productId: string,
    patch: Record<string, unknown>,
  ) => Promise<{ id: string } | null>;
  setProductAvailability: (
    merchantId: string,
    productId: string,
    available: boolean,
  ) => Promise<{ id: string; available: boolean } | null>;
};

function parseStockMode(value: string): StockMode | null {
  return STOCK_MODES.includes(value as StockMode) ? (value as StockMode) : null;
}

function validateProductName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return "El nombre del producto es obligatorio.";
  }
  if (trimmed.length > 160) {
    return "El nombre es demasiado largo.";
  }
  return null;
}

function buildProductDraft(input: {
  merchantId: string;
  merchantCategoryId: string;
  name: string;
  description: string;
  priceCents: number;
  active: boolean;
  available: boolean;
  stockMode: StockMode;
  stockQuantity: number | null;
  sortOrder: number;
}) {
  return {
    id: "draft" as const,
    merchantId: input.merchantId,
    merchantCategoryId: input.merchantCategoryId,
    name: input.name,
    description: input.description,
    priceCents: moneyCents(input.priceCents),
    active: input.active,
    available: input.available,
    stockMode: input.stockMode,
    stockQuantity: input.stockQuantity,
    sortOrder: input.sortOrder,
  };
}

export async function createProduct(
  merchantId: string,
  input: {
    merchantCategoryId: string;
    name: string;
    description?: string;
    priceInput: string;
    active?: boolean;
    available?: boolean;
    stockMode: string;
    stockQuantity?: number | null;
  },
  deps: ProductDeps,
): Promise<Result<{ id: string }, CatalogApplicationError>> {
  await deps.requireCatalogAccess(merchantId);

  if (!isValidUuid(input.merchantCategoryId)) {
    return err({
      code: "INVALID_CATEGORY",
      message: "La categoría no es válida.",
    });
  }

  const category = await deps.findMerchantCategoryById(
    merchantId,
    input.merchantCategoryId,
  );
  if (!category) {
    return err({
      code: "CATEGORY_NOT_FOUND",
      message: "La categoría no pertenece a este comercio.",
    });
  }

  const nameError = validateProductName(input.name);
  if (nameError) {
    return err({ code: "INVALID_NAME", message: nameError });
  }

  let priceCents: number;
  try {
    priceCents = parseMoneyInputToCents(input.priceInput);
  } catch (error) {
    if (error instanceof DomainError) {
      return err({ code: error.code, message: error.message });
    }
    return err({ code: "INVALID_PRICE", message: "El precio no es válido." });
  }

  const stockMode = parseStockMode(input.stockMode);
  if (!stockMode) {
    return err({
      code: "INVALID_STOCK_MODE",
      message: "El modo de stock no es válido.",
    });
  }

  let stockQuantity: number | null = null;
  if (stockMode === "TRACKED") {
    const qty = input.stockQuantity;
    if (
      qty === null ||
      qty === undefined ||
      !Number.isInteger(qty) ||
      !Number.isSafeInteger(qty) ||
      qty < 0
    ) {
      return err({
        code: "INVALID_STOCK",
        message: "El stock debe ser un entero mayor o igual a 0.",
      });
    }
    stockQuantity = qty;
  }

  const sortOrder = await deps.nextProductSortOrder(
    merchantId,
    input.merchantCategoryId,
  );

  try {
    assertProduct(
      buildProductDraft({
        merchantId,
        merchantCategoryId: input.merchantCategoryId,
        name: input.name.trim(),
        description: (input.description ?? "").trim(),
        priceCents,
        active: input.active ?? true,
        available: input.available ?? true,
        stockMode,
        stockQuantity,
        sortOrder,
      }),
    );
  } catch (error) {
    if (error instanceof DomainError) {
      return err({ code: error.code, message: error.message });
    }
    return err({
      code: "INVALID_PRODUCT",
      message: "Los datos del producto no son válidos.",
    });
  }

  const product = await deps.insertProduct({
    merchantId,
    merchantCategoryId: input.merchantCategoryId,
    name: input.name.trim(),
    description: (input.description ?? "").trim(),
    priceCents,
    active: input.active ?? true,
    available: input.available ?? true,
    stockMode,
    stockQuantity,
    sortOrder,
  });

  return ok({ id: product.id });
}

export async function updateProduct(
  merchantId: string,
  productId: string,
  input: {
    merchantCategoryId?: string;
    name?: string;
    description?: string;
    priceInput?: string;
    active?: boolean;
    available?: boolean;
    stockMode?: string;
    stockQuantity?: number | null;
  },
  deps: ProductDeps,
): Promise<Result<{ id: string }, CatalogApplicationError>> {
  await deps.requireCatalogAccess(merchantId);

  if (!isValidUuid(productId)) {
    return err({
      code: "PRODUCT_NOT_FOUND",
      message: "El producto no existe.",
    });
  }

  const existing = await deps.findProductById(merchantId, productId);
  if (!existing) {
    return err({
      code: "PRODUCT_NOT_FOUND",
      message: "El producto no existe.",
    });
  }

  const patch: Record<string, unknown> = {};

  if (input.merchantCategoryId !== undefined) {
    if (!isValidUuid(input.merchantCategoryId)) {
      return err({
        code: "INVALID_CATEGORY",
        message: "La categoría no es válida.",
      });
    }
    const category = await deps.findMerchantCategoryById(
      merchantId,
      input.merchantCategoryId,
    );
    if (!category) {
      return err({
        code: "CATEGORY_NOT_FOUND",
        message: "La categoría no pertenece a este comercio.",
      });
    }
    patch.merchantCategoryId = input.merchantCategoryId;
  }

  if (input.name !== undefined) {
    const nameError = validateProductName(input.name);
    if (nameError) {
      return err({ code: "INVALID_NAME", message: nameError });
    }
    patch.name = input.name.trim();
  }

  if (input.description !== undefined) {
    patch.description = input.description.trim();
  }

  if (input.priceInput !== undefined) {
    try {
      patch.priceCents = parseMoneyInputToCents(input.priceInput);
    } catch (error) {
      if (error instanceof DomainError) {
        return err({ code: error.code, message: error.message });
      }
      return err({ code: "INVALID_PRICE", message: "El precio no es válido." });
    }
  }

  if (input.active !== undefined) {
    patch.active = Boolean(input.active);
  }
  if (input.available !== undefined) {
    patch.available = Boolean(input.available);
  }

  const nextStockMode = input.stockMode
    ? parseStockMode(input.stockMode)
    : (existing.stockMode as StockMode);
  if (input.stockMode && !nextStockMode) {
    return err({
      code: "INVALID_STOCK_MODE",
      message: "El modo de stock no es válido.",
    });
  }

  if (nextStockMode) {
    patch.stockMode = nextStockMode;
    if (nextStockMode === "TRACKED") {
      const qty =
        input.stockQuantity !== undefined
          ? input.stockQuantity
          : existing.stockQuantity;
      if (
        qty === null ||
        qty === undefined ||
        !Number.isInteger(qty) ||
        !Number.isSafeInteger(qty) ||
        qty < 0
      ) {
        return err({
          code: "INVALID_STOCK",
          message: "El stock debe ser un entero mayor o igual a 0.",
        });
      }
      patch.stockQuantity = qty;
    } else {
      patch.stockQuantity = null;
    }
  } else if (input.stockQuantity !== undefined) {
    patch.stockQuantity = input.stockQuantity;
  }

  const merged = {
    id: existing.id,
    merchantId,
    merchantCategoryId:
      (patch.merchantCategoryId as string) ?? existing.merchantCategoryId,
    name: (patch.name as string) ?? existing.name,
    description: (patch.description as string) ?? existing.description,
    priceCents: moneyCents((patch.priceCents as number) ?? existing.priceCents),
    active: (patch.active as boolean) ?? existing.active,
    available: (patch.available as boolean) ?? existing.available,
    stockMode:
      (patch.stockMode as StockMode) ?? (existing.stockMode as StockMode),
    stockQuantity:
      patch.stockQuantity !== undefined
        ? (patch.stockQuantity as number | null)
        : existing.stockQuantity,
    sortOrder: existing.sortOrder,
  };

  try {
    assertProduct(merged);
  } catch (error) {
    if (error instanceof DomainError) {
      return err({ code: error.code, message: error.message });
    }
    return err({
      code: "INVALID_PRODUCT",
      message: "Los datos del producto no son válidos.",
    });
  }

  const updated = await deps.updateProduct(merchantId, productId, patch);
  if (!updated) {
    return err({
      code: "PRODUCT_NOT_FOUND",
      message: "El producto no existe.",
    });
  }
  return ok({ id: updated.id });
}

export async function toggleProductAvailability(
  merchantId: string,
  productId: string,
  deps: ProductDeps,
): Promise<
  Result<
    { id: string; available: boolean; sellable: boolean },
    CatalogApplicationError
  >
> {
  await deps.requireCatalogAccess(merchantId);

  if (!isValidUuid(productId)) {
    return err({
      code: "PRODUCT_NOT_FOUND",
      message: "El producto no existe.",
    });
  }

  const existing = await deps.findProductById(merchantId, productId);
  if (!existing) {
    return err({
      code: "PRODUCT_NOT_FOUND",
      message: "El producto no existe.",
    });
  }

  const nextAvailable = !existing.available;
  const updated = await deps.setProductAvailability(
    merchantId,
    productId,
    nextAvailable,
  );
  if (!updated) {
    return err({
      code: "PRODUCT_NOT_FOUND",
      message: "El producto no existe.",
    });
  }

  const sellable = isProductSellable({
    ...existing,
    merchantId,
    available: nextAvailable,
    priceCents: moneyCents(existing.priceCents),
    stockMode: existing.stockMode as StockMode,
  });

  return ok({
    id: updated.id,
    available: nextAvailable,
    sellable,
  });
}

export { assertProductStock, isProductSellable };
