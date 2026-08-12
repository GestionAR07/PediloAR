import { isProductOperationallyAvailable } from "@/domain/catalog/product";
import type { StockMode } from "@/domain/catalog/enums";

export type ProductAvailabilityFields = {
  active: boolean;
  available: boolean;
  stockMode: string;
  stockQuantity: number | null;
};

export type MerchantProductAvailabilityStatus = {
  label: string;
  detail: string | null;
  operationallyAvailable: boolean;
};

/**
 * Merchant-facing status for catalog admin. Does not mutate stored flags.
 */
export function getMerchantProductAvailabilityStatus(
  product: ProductAvailabilityFields,
): MerchantProductAvailabilityStatus {
  const operationallyAvailable = isProductOperationallyAvailable({
    active: product.active,
    available: product.available,
    stockMode: product.stockMode as StockMode,
    stockQuantity: product.stockQuantity,
  });

  if (!product.active) {
    return {
      label: "Inactivo",
      detail: null,
      operationallyAvailable: false,
    };
  }

  const tracked = product.stockMode === "TRACKED";
  const stock = product.stockQuantity ?? 0;
  const stockDetail = tracked ? `Stock: ${stock}` : null;

  if (!product.available) {
    return {
      label: "No disponible",
      detail:
        tracked && stock > 0 ? `${stockDetail} · venta pausada` : stockDetail,
      operationallyAvailable: false,
    };
  }

  if (tracked && stock === 0) {
    return {
      label: "Sin stock",
      detail: "Stock: 0",
      operationallyAvailable: false,
    };
  }

  return {
    label: "Disponible",
    detail: stockDetail,
    operationallyAvailable,
  };
}

export function getProductAvailabilityToggleLabel(available: boolean): string {
  return available ? "Pausar venta" : "Reanudar venta";
}

export function getProductAvailabilityToggleSuccessMessage(
  available: boolean,
): string {
  return available ? "Venta reanudada" : "Venta pausada";
}
