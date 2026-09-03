import "server-only";

import { and, count, eq, gt, ne, or } from "drizzle-orm";
import { getDb } from "../client";
import {
  merchantCategories,
  merchantDeliveryZones,
  merchantPaymentMethods,
  merchants,
  merchantUsers,
  products,
  userProfiles,
} from "../schema";
import type { MerchantActivationReadiness } from "@/application/merchant/activate-merchant";

function numericCount(
  value: number | string | bigint | null | undefined,
): number {
  return Number(value ?? 0);
}

export async function findMerchantActivationReadiness(
  merchantId: string,
): Promise<MerchantActivationReadiness | null> {
  const db = getDb();
  const merchantRows = await db
    .select({
      id: merchants.id,
      status: merchants.status,
      pickupEnabled: merchants.pickupEnabled,
      merchantDeliveryEnabled: merchants.merchantDeliveryEnabled,
    })
    .from(merchants)
    .where(eq(merchants.id, merchantId))
    .limit(1);
  const merchant = merchantRows[0];
  if (!merchant) return null;

  const [ownerRows, deliveryRows, paymentRows, productRows] = await Promise.all(
    [
      db
        .select({ value: count() })
        .from(merchantUsers)
        .innerJoin(userProfiles, eq(userProfiles.id, merchantUsers.userId))
        .where(
          and(
            eq(merchantUsers.merchantId, merchantId),
            eq(merchantUsers.role, "OWNER"),
            eq(merchantUsers.active, true),
            eq(userProfiles.status, "ACTIVE"),
          ),
        ),
      db
        .select({ value: count() })
        .from(merchantDeliveryZones)
        .where(
          and(
            eq(merchantDeliveryZones.merchantId, merchantId),
            eq(merchantDeliveryZones.active, true),
          ),
        ),
      db
        .select({ value: count() })
        .from(merchantPaymentMethods)
        .where(
          and(
            eq(merchantPaymentMethods.merchantId, merchantId),
            eq(merchantPaymentMethods.active, true),
          ),
        ),
      db
        .select({ value: count() })
        .from(products)
        .innerJoin(
          merchantCategories,
          eq(merchantCategories.id, products.merchantCategoryId),
        )
        .where(
          and(
            eq(products.merchantId, merchantId),
            eq(products.active, true),
            eq(products.available, true),
            eq(merchantCategories.active, true),
            or(
              ne(products.stockMode, "TRACKED"),
              gt(products.stockQuantity, 0),
            ),
          ),
        ),
    ],
  );

  return {
    merchantId: merchant.id,
    status: merchant.status,
    pickupEnabled: merchant.pickupEnabled,
    merchantDeliveryEnabled: merchant.merchantDeliveryEnabled,
    activeOwnerCount: numericCount(ownerRows[0]?.value),
    activeDeliveryZoneCount: numericCount(deliveryRows[0]?.value),
    activePaymentMethodCount: numericCount(paymentRows[0]?.value),
    activeCatalogProductCount: numericCount(productRows[0]?.value),
  };
}

/**
 * Conditional write: onboarding may only move DRAFT -> ACTIVE.
 * SUSPENDED merchants require a separate operational reactivation flow.
 */
export async function activateMerchantDraftById(
  merchantId: string,
): Promise<{ id: string; status: string } | null> {
  const db = getDb();
  const rows = await db
    .update(merchants)
    .set({ status: "ACTIVE", updatedAt: new Date() })
    .where(and(eq(merchants.id, merchantId), eq(merchants.status, "DRAFT")))
    .returning({ id: merchants.id, status: merchants.status });

  return rows[0] ?? null;
}
