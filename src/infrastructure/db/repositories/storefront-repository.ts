import "server-only";

import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "../client";
import {
  cities,
  merchantCategories,
  merchantDeliveryZones,
  merchantOpeningIntervals,
  merchantPaymentMethods,
  merchants,
  productOptionChoices,
  productOptionGroups,
  products,
  zones,
} from "../schema";

export type PublicZoneOptionRecord = {
  id: string;
  name: string;
  slug: string;
  cityId: string;
  cityName: string;
  cityTimezone: string;
};

export type PublicMerchantDiscoveryRow = {
  id: string;
  name: string;
  description: string;
  status: string;
  zoneId: string;
  zoneName: string;
  cityId: string;
  cityName: string;
  cityTimezone: string;
  pickupEnabled: boolean;
  merchantDeliveryEnabled: boolean;
  preparationMinutes: number;
  acceptingOrders: boolean;
  pausedUntil: Date | null;
};

export type PublicDeliveryZoneRecord = {
  merchantId: string;
  zoneId: string;
  zoneName: string;
  deliveryFeeCents: number;
  minimumOrderCents: number;
  estimatedMinutes: number;
  active: boolean;
};

export type PublicPaymentMethodRecord = {
  code: string;
  label: string;
  instructions: string;
  sortOrder: number;
};

export type PublicOpeningIntervalRecord = {
  id: string;
  merchantId: string;
  weekday: number;
  openMinute: number;
  closeMinute: number;
};

export type PublicCatalogProductRow = {
  id: string;
  merchantCategoryId: string;
  categoryName: string;
  name: string;
  description: string;
  priceCents: number;
  active: boolean;
  available: boolean;
  stockMode: string;
  stockQuantity: number | null;
  sortOrder: number;
  imagePath: string | null;
  optionGroupCount: number;
};

export type PublicOptionGroupRow = {
  id: string;
  productId: string;
  name: string;
  selectionMode: string;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
};

export type PublicOptionChoiceRow = {
  id: string;
  groupId: string;
  name: string;
  priceDeltaCents: number;
  sortOrder: number;
};

export async function listPublicZoneOptions(): Promise<
  PublicZoneOptionRecord[]
> {
  const db = getDb();
  return db
    .select({
      id: zones.id,
      name: zones.name,
      slug: zones.slug,
      cityId: cities.id,
      cityName: cities.name,
      cityTimezone: cities.timezone,
    })
    .from(zones)
    .innerJoin(cities, eq(cities.id, zones.cityId))
    .orderBy(asc(cities.name), asc(zones.name));
}

export async function findPublicZoneById(
  zoneId: string,
): Promise<PublicZoneOptionRecord | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: zones.id,
      name: zones.name,
      slug: zones.slug,
      cityId: cities.id,
      cityName: cities.name,
      cityTimezone: cities.timezone,
    })
    .from(zones)
    .innerJoin(cities, eq(cities.id, zones.cityId))
    .where(eq(zones.id, zoneId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * ACTIVE merchants that can serve the customer zone via pickup and/or delivery.
 */
export async function listActiveMerchantsServingZone(
  zoneId: string,
): Promise<PublicMerchantDiscoveryRow[]> {
  const db = getDb();

  const deliversToZone = db
    .select({ merchantId: merchantDeliveryZones.merchantId })
    .from(merchantDeliveryZones)
    .where(
      and(
        eq(merchantDeliveryZones.zoneId, zoneId),
        eq(merchantDeliveryZones.active, true),
      ),
    );

  const rows = await db
    .select({
      id: merchants.id,
      name: merchants.name,
      description: merchants.description,
      status: merchants.status,
      zoneId: merchants.zoneId,
      zoneName: zones.name,
      cityId: merchants.cityId,
      cityName: cities.name,
      cityTimezone: cities.timezone,
      pickupEnabled: merchants.pickupEnabled,
      merchantDeliveryEnabled: merchants.merchantDeliveryEnabled,
      preparationMinutes: merchants.preparationMinutes,
      acceptingOrders: merchants.acceptingOrders,
      pausedUntil: merchants.pausedUntil,
    })
    .from(merchants)
    .innerJoin(cities, eq(cities.id, merchants.cityId))
    .innerJoin(zones, eq(zones.id, merchants.zoneId))
    .where(
      and(
        eq(merchants.status, "ACTIVE"),
        or(
          and(eq(merchants.pickupEnabled, true), eq(merchants.zoneId, zoneId)),
          and(
            eq(merchants.merchantDeliveryEnabled, true),
            inArray(merchants.id, deliversToZone),
          ),
        ),
      ),
    )
    .orderBy(asc(merchants.name));

  return rows;
}

export async function findActivePublicMerchantById(
  merchantId: string,
): Promise<PublicMerchantDiscoveryRow | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: merchants.id,
      name: merchants.name,
      description: merchants.description,
      status: merchants.status,
      zoneId: merchants.zoneId,
      zoneName: zones.name,
      cityId: merchants.cityId,
      cityName: cities.name,
      cityTimezone: cities.timezone,
      pickupEnabled: merchants.pickupEnabled,
      merchantDeliveryEnabled: merchants.merchantDeliveryEnabled,
      preparationMinutes: merchants.preparationMinutes,
      acceptingOrders: merchants.acceptingOrders,
      pausedUntil: merchants.pausedUntil,
    })
    .from(merchants)
    .innerJoin(cities, eq(cities.id, merchants.cityId))
    .innerJoin(zones, eq(zones.id, merchants.zoneId))
    .where(and(eq(merchants.id, merchantId), eq(merchants.status, "ACTIVE")))
    .limit(1);
  return rows[0] ?? null;
}

export async function listActiveDeliveryZonesForMerchants(
  merchantIds: string[],
  customerZoneId?: string,
): Promise<PublicDeliveryZoneRecord[]> {
  if (merchantIds.length === 0) {
    return [];
  }
  const db = getDb();
  const conditions = [
    inArray(merchantDeliveryZones.merchantId, merchantIds),
    eq(merchantDeliveryZones.active, true),
  ];
  if (customerZoneId) {
    conditions.push(eq(merchantDeliveryZones.zoneId, customerZoneId));
  }

  const rows = await db
    .select({
      merchantId: merchantDeliveryZones.merchantId,
      zoneId: merchantDeliveryZones.zoneId,
      zoneName: zones.name,
      deliveryFeeCents: merchantDeliveryZones.deliveryFeeCents,
      minimumOrderCents: merchantDeliveryZones.minimumOrderCents,
      estimatedMinutes: merchantDeliveryZones.estimatedMinutes,
      active: merchantDeliveryZones.active,
    })
    .from(merchantDeliveryZones)
    .innerJoin(zones, eq(zones.id, merchantDeliveryZones.zoneId))
    .where(and(...conditions));

  return rows.map((row) => ({
    ...row,
    deliveryFeeCents: Number(row.deliveryFeeCents),
    minimumOrderCents: Number(row.minimumOrderCents),
  }));
}

export async function listActivePaymentMethodsForMerchant(
  merchantId: string,
): Promise<PublicPaymentMethodRecord[]> {
  const db = getDb();
  return db
    .select({
      code: merchantPaymentMethods.code,
      label: merchantPaymentMethods.label,
      instructions: merchantPaymentMethods.instructions,
      sortOrder: merchantPaymentMethods.sortOrder,
    })
    .from(merchantPaymentMethods)
    .where(
      and(
        eq(merchantPaymentMethods.merchantId, merchantId),
        eq(merchantPaymentMethods.active, true),
      ),
    )
    .orderBy(
      asc(merchantPaymentMethods.sortOrder),
      asc(merchantPaymentMethods.label),
    );
}

export async function listOpeningIntervalsForMerchant(
  merchantId: string,
): Promise<PublicOpeningIntervalRecord[]> {
  return listOpeningIntervalsForMerchants([merchantId]);
}

export async function listOpeningIntervalsForMerchants(
  merchantIds: string[],
): Promise<PublicOpeningIntervalRecord[]> {
  if (merchantIds.length === 0) {
    return [];
  }
  const db = getDb();
  return db
    .select({
      id: merchantOpeningIntervals.id,
      merchantId: merchantOpeningIntervals.merchantId,
      weekday: merchantOpeningIntervals.weekday,
      openMinute: merchantOpeningIntervals.openMinute,
      closeMinute: merchantOpeningIntervals.closeMinute,
    })
    .from(merchantOpeningIntervals)
    .where(inArray(merchantOpeningIntervals.merchantId, merchantIds))
    .orderBy(
      asc(merchantOpeningIntervals.weekday),
      asc(merchantOpeningIntervals.openMinute),
    );
}

export async function listPublicActiveProductsForMerchant(
  merchantId: string,
): Promise<PublicCatalogProductRow[]> {
  const db = getDb();

  const optionCounts = db
    .select({
      productId: productOptionGroups.productId,
      optionGroupCount: sql<number>`count(${productOptionGroups.id})`.as(
        "option_group_count",
      ),
    })
    .from(productOptionGroups)
    .where(eq(productOptionGroups.active, true))
    .groupBy(productOptionGroups.productId)
    .as("public_option_counts");

  const rows = await db
    .select({
      id: products.id,
      merchantCategoryId: products.merchantCategoryId,
      categoryName: merchantCategories.name,
      name: products.name,
      description: products.description,
      priceCents: products.priceCents,
      active: products.active,
      available: products.available,
      stockMode: products.stockMode,
      stockQuantity: products.stockQuantity,
      sortOrder: products.sortOrder,
      imagePath: products.imagePath,
      optionGroupCount: optionCounts.optionGroupCount,
    })
    .from(products)
    .innerJoin(
      merchantCategories,
      and(
        eq(merchantCategories.id, products.merchantCategoryId),
        eq(merchantCategories.merchantId, merchantId),
        eq(merchantCategories.active, true),
      ),
    )
    .leftJoin(optionCounts, eq(optionCounts.productId, products.id))
    .where(and(eq(products.merchantId, merchantId), eq(products.active, true)))
    .orderBy(
      asc(merchantCategories.sortOrder),
      asc(products.sortOrder),
      asc(products.name),
    );

  return rows.map((row) => ({
    id: row.id,
    merchantCategoryId: row.merchantCategoryId,
    categoryName: row.categoryName,
    name: row.name,
    description: row.description,
    priceCents: Number(row.priceCents),
    active: row.active,
    available: row.available,
    stockMode: row.stockMode,
    stockQuantity: row.stockQuantity,
    sortOrder: row.sortOrder,
    imagePath: row.imagePath,
    optionGroupCount: Number(row.optionGroupCount ?? 0),
  }));
}

export async function listPublicActiveCategoriesForMerchant(
  merchantId: string,
): Promise<Array<{ id: string; name: string; sortOrder: number }>> {
  const db = getDb();
  return db
    .select({
      id: merchantCategories.id,
      name: merchantCategories.name,
      sortOrder: merchantCategories.sortOrder,
    })
    .from(merchantCategories)
    .where(
      and(
        eq(merchantCategories.merchantId, merchantId),
        eq(merchantCategories.active, true),
      ),
    )
    .orderBy(asc(merchantCategories.sortOrder), asc(merchantCategories.name));
}

export async function listPublicActiveOptionGroupsForProducts(
  merchantId: string,
  productIds: string[],
): Promise<PublicOptionGroupRow[]> {
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
    })
    .from(productOptionGroups)
    .innerJoin(products, eq(products.id, productOptionGroups.productId))
    .where(
      and(
        eq(products.merchantId, merchantId),
        eq(productOptionGroups.active, true),
        inArray(productOptionGroups.productId, productIds),
      ),
    )
    .orderBy(asc(productOptionGroups.sortOrder), asc(productOptionGroups.name));
}

export async function listPublicActiveOptionChoicesForGroups(
  groupIds: string[],
): Promise<PublicOptionChoiceRow[]> {
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
    })
    .from(productOptionChoices)
    .where(
      and(
        eq(productOptionChoices.active, true),
        inArray(productOptionChoices.groupId, groupIds),
      ),
    )
    .orderBy(
      asc(productOptionChoices.sortOrder),
      asc(productOptionChoices.name),
    );

  return rows.map((row) => ({
    ...row,
    priceDeltaCents: Number(row.priceDeltaCents),
  }));
}
