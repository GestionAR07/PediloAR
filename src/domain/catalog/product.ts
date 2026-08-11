import { assertNonNegativeMoneyCents } from "../money/money-cents";
import { DomainError } from "../shared/errors";
import type { Product } from "./types";

export function assertProductPricing(
  product: Pick<Product, "priceCents">,
): void {
  assertNonNegativeMoneyCents(product.priceCents);
}

export function assertProductStock(
  product: Pick<Product, "stockMode" | "stockQuantity">,
): void {
  if (product.stockMode === "NOT_TRACKED") {
    return;
  }

  if (product.stockMode !== "TRACKED") {
    throw new DomainError("PRODUCT_INVALID_STOCK_MODE", "Unknown stock mode");
  }

  if (
    product.stockQuantity === null ||
    product.stockQuantity === undefined ||
    !Number.isInteger(product.stockQuantity) ||
    !Number.isSafeInteger(product.stockQuantity) ||
    product.stockQuantity < 0
  ) {
    throw new DomainError(
      "PRODUCT_TRACKED_STOCK_REQUIRED",
      "TRACKED products require stockQuantity as a non-negative safe integer",
    );
  }
}

export function assertProduct(product: Product): void {
  if (!product.name.trim()) {
    throw new DomainError("PRODUCT_NAME_REQUIRED", "Product name is required");
  }

  assertProductPricing(product);
  assertProductStock(product);

  if (!Number.isInteger(product.sortOrder)) {
    throw new DomainError(
      "PRODUCT_INVALID_SORT",
      "sortOrder must be an integer",
    );
  }
}

/** A product can be sold only when active, available, and (if tracked) in stock. */
export function isProductSellable(product: Product): boolean {
  assertProduct(product);

  if (!product.active || !product.available) {
    return false;
  }

  if (product.stockMode === "TRACKED") {
    return (product.stockQuantity ?? 0) > 0;
  }

  return true;
}
