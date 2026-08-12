import { isProductOperationallyAvailable } from "@/domain/catalog/product";
import type { StockMode } from "@/domain/catalog/enums";

export type PublicProductPurchaseFields = {
  active: boolean;
  available: boolean;
  stockMode: string;
  stockQuantity: number | null;
};

export type PublicProductPurchasePresentation = {
  /** active=false products must not be listed publicly. */
  visible: boolean;
  sellable: boolean;
  statusLabel: string | null;
};

/**
 * Visibility vs sellability for the public storefront.
 * active=false → hidden. active + !sellable → visible with status.
 */
export function getPublicProductPurchasePresentation(
  product: PublicProductPurchaseFields,
): PublicProductPurchasePresentation {
  if (!product.active) {
    return { visible: false, sellable: false, statusLabel: null };
  }

  const sellable = isProductOperationallyAvailable({
    active: product.active,
    available: product.available,
    stockMode: product.stockMode as StockMode,
    stockQuantity: product.stockQuantity,
  });

  if (sellable) {
    return { visible: true, sellable: true, statusLabel: null };
  }

  if (!product.available) {
    return { visible: true, sellable: false, statusLabel: "No disponible" };
  }

  if (product.stockMode === "TRACKED" && (product.stockQuantity ?? 0) <= 0) {
    return { visible: true, sellable: false, statusLabel: "Sin stock" };
  }

  return { visible: true, sellable: false, statusLabel: "No disponible" };
}
