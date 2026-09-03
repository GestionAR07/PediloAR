"use server";

import { getPublicMerchantCatalogApp } from "@/application/storefront/wiring";
import { hasDatabaseConfig } from "@/infrastructure/db/env";
import { isValidUuid } from "@/lib/uuid";

export type CartProductAvailability = {
  sellable: boolean;
  statusLabel: string | null;
};

export type CartAvailabilityActionResult =
  | {
      ok: true;
      products: Record<string, CartProductAvailability>;
    }
  | {
      ok: false;
    };

const MAX_CART_PRODUCT_IDS = 100;

export async function getCartAvailabilityAction(
  merchantId: string,
  productIds: string[],
): Promise<CartAvailabilityActionResult> {
  if (
    !hasDatabaseConfig() ||
    typeof merchantId !== "string" ||
    !isValidUuid(merchantId) ||
    !Array.isArray(productIds) ||
    productIds.length > MAX_CART_PRODUCT_IDS ||
    productIds.some(
      (productId) => typeof productId !== "string" || !isValidUuid(productId),
    )
  ) {
    return { ok: false };
  }

  const uniqueProductIds = [...new Set(productIds)];

  try {
    const catalog = await getPublicMerchantCatalogApp(merchantId);
    if (!catalog) {
      return { ok: false };
    }

    const publicProducts = new Map(
      catalog.products.map((product) => [product.id, product] as const),
    );
    const products: Record<string, CartProductAvailability> = {};

    for (const productId of uniqueProductIds) {
      const product = publicProducts.get(productId);
      products[productId] = product
        ? {
            sellable: product.sellable,
            statusLabel: product.statusLabel,
          }
        : {
            sellable: false,
            statusLabel: "No disponible",
          };
    }

    return { ok: true, products };
  } catch {
    return { ok: false };
  }
}
