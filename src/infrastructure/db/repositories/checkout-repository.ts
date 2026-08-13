import "server-only";

import { asc, eq, inArray } from "drizzle-orm";
import type {
  CheckoutDeliveryZoneRecord,
  CheckoutMerchantRecord,
  CheckoutOptionChoiceRecord,
  CheckoutOptionGroupRecord,
  CheckoutPaymentMethodRecord,
  CheckoutProductRecord,
} from "@/application/checkout/types";
import { getDb } from "../client";
import {
  cities,
  merchantDeliveryZones,
  merchantPaymentMethods,
  merchants,
  productOptionChoices,
  productOptionGroups,
  products,
  zones,
} from "../schema";

/**
 * Read-only checkout lookups. Does not insert Orders, decrement stock,
 * or create Delivery / OrderEvent rows.
 */
export async function findMerchantForCheckout(
  merchantId: string,
): Promise<CheckoutMerchantRecord | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: merchants.id,
      name: merchants.name,
      status: merchants.status,
      cityId: merchants.cityId,
      cityName: cities.name,
      zoneId: merchants.zoneId,
      zoneName: zones.name,
      pickupEnabled: merchants.pickupEnabled,
      merchantDeliveryEnabled: merchants.merchantDeliveryEnabled,
      platformDeliveryEnabled: merchants.platformDeliveryEnabled,
      acceptingOrders: merchants.acceptingOrders,
      pausedUntil: merchants.pausedUntil,
      preparationMinutes: merchants.preparationMinutes,
    })
    .from(merchants)
    .innerJoin(cities, eq(cities.id, merchants.cityId))
    .innerJoin(zones, eq(zones.id, merchants.zoneId))
    .where(eq(merchants.id, merchantId))
    .limit(1);

  return rows[0] ?? null;
}

export async function listProductsByIdsForCheckout(
  productIds: string[],
): Promise<CheckoutProductRecord[]> {
  if (productIds.length === 0) {
    return [];
  }
  const db = getDb();
  const rows = await db
    .select({
      id: products.id,
      merchantId: products.merchantId,
      name: products.name,
      priceCents: products.priceCents,
      active: products.active,
      available: products.available,
      stockMode: products.stockMode,
      stockQuantity: products.stockQuantity,
      sortOrder: products.sortOrder,
    })
    .from(products)
    .where(inArray(products.id, productIds));

  return rows.map((row) => ({
    ...row,
    priceCents: Number(row.priceCents),
  }));
}

export async function listOptionGroupsForProductsCheckout(
  productIds: string[],
): Promise<CheckoutOptionGroupRecord[]> {
  if (productIds.length === 0) {
    return [];
  }
  const db = getDb();
  return db
    .select({
      id: productOptionGroups.id,
      productId: productOptionGroups.productId,
      name: productOptionGroups.name,
      selectionMode: productOptionGroups.selectionMode,
      minSelections: productOptionGroups.minSelections,
      maxSelections: productOptionGroups.maxSelections,
      sortOrder: productOptionGroups.sortOrder,
      active: productOptionGroups.active,
    })
    .from(productOptionGroups)
    .where(inArray(productOptionGroups.productId, productIds))
    .orderBy(asc(productOptionGroups.sortOrder), asc(productOptionGroups.name));
}

export async function listOptionChoicesForGroupsCheckout(
  groupIds: string[],
): Promise<CheckoutOptionChoiceRecord[]> {
  if (groupIds.length === 0) {
    return [];
  }
  const db = getDb();
  const rows = await db
    .select({
      id: productOptionChoices.id,
      groupId: productOptionChoices.groupId,
      name: productOptionChoices.name,
      priceDeltaCents: productOptionChoices.priceDeltaCents,
      sortOrder: productOptionChoices.sortOrder,
      active: productOptionChoices.active,
    })
    .from(productOptionChoices)
    .where(inArray(productOptionChoices.groupId, groupIds))
    .orderBy(
      asc(productOptionChoices.sortOrder),
      asc(productOptionChoices.name),
    );

  return rows.map((row) => ({
    ...row,
    priceDeltaCents: Number(row.priceDeltaCents),
  }));
}

export async function listPaymentMethodsForCheckout(
  merchantId: string,
): Promise<CheckoutPaymentMethodRecord[]> {
  const db = getDb();
  return db
    .select({
      code: merchantPaymentMethods.code,
      label: merchantPaymentMethods.label,
      instructions: merchantPaymentMethods.instructions,
      active: merchantPaymentMethods.active,
    })
    .from(merchantPaymentMethods)
    .where(eq(merchantPaymentMethods.merchantId, merchantId))
    .orderBy(
      asc(merchantPaymentMethods.sortOrder),
      asc(merchantPaymentMethods.label),
    );
}

export async function listDeliveryZonesForCheckout(
  merchantId: string,
): Promise<CheckoutDeliveryZoneRecord[]> {
  const db = getDb();
  const rows = await db
    .select({
      merchantId: merchantDeliveryZones.merchantId,
      zoneId: merchantDeliveryZones.zoneId,
      zoneName: zones.name,
      cityId: cities.id,
      cityName: cities.name,
      deliveryFeeCents: merchantDeliveryZones.deliveryFeeCents,
      minimumOrderCents: merchantDeliveryZones.minimumOrderCents,
      estimatedMinutes: merchantDeliveryZones.estimatedMinutes,
      active: merchantDeliveryZones.active,
    })
    .from(merchantDeliveryZones)
    .innerJoin(zones, eq(zones.id, merchantDeliveryZones.zoneId))
    .innerJoin(cities, eq(cities.id, zones.cityId))
    .where(eq(merchantDeliveryZones.merchantId, merchantId))
    .orderBy(asc(zones.name));

  return rows.map((row) => ({
    ...row,
    deliveryFeeCents: Number(row.deliveryFeeCents),
    minimumOrderCents: Number(row.minimumOrderCents),
  }));
}
