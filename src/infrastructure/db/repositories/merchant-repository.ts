import "server-only";

import { and, asc, count, desc, eq } from "drizzle-orm";
import { getDb } from "../client";
import {
  cities,
  merchantUsers,
  merchants,
  userProfiles,
  zones,
} from "../schema";

export type MerchantListRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  cityName: string;
  zoneName: string;
  pickupEnabled: boolean;
  merchantDeliveryEnabled: boolean;
  ownerCount: number;
  createdAt: Date;
};

export type MerchantDetailRecord = {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  cityId: string;
  zoneId: string;
  cityName: string;
  zoneName: string;
  pickupEnabled: boolean;
  merchantDeliveryEnabled: boolean;
  platformDeliveryEnabled: boolean;
  preparationMinutes: number;
  createdAt: Date;
  updatedAt: Date;
};

export type MerchantMemberRecord = {
  id: string;
  userId: string;
  role: string;
  active: boolean;
  displayName: string | null;
  createdAt: Date;
};

export type InsertMerchantInput = {
  name: string;
  slug: string;
  description: string;
  cityId: string;
  zoneId: string;
  pickupEnabled: boolean;
  merchantDeliveryEnabled: boolean;
  preparationMinutes: number;
};

export async function listMerchantsForAdmin(): Promise<MerchantListRow[]> {
  const db = getDb();

  const ownerCounts = db
    .select({
      merchantId: merchantUsers.merchantId,
      ownerCount: count(merchantUsers.id).as("owner_count"),
    })
    .from(merchantUsers)
    .where(and(eq(merchantUsers.role, "OWNER"), eq(merchantUsers.active, true)))
    .groupBy(merchantUsers.merchantId)
    .as("owner_counts");

  const rows = await db
    .select({
      id: merchants.id,
      name: merchants.name,
      slug: merchants.slug,
      status: merchants.status,
      cityName: cities.name,
      zoneName: zones.name,
      pickupEnabled: merchants.pickupEnabled,
      merchantDeliveryEnabled: merchants.merchantDeliveryEnabled,
      ownerCount: ownerCounts.ownerCount,
      createdAt: merchants.createdAt,
    })
    .from(merchants)
    .innerJoin(cities, eq(cities.id, merchants.cityId))
    .innerJoin(zones, eq(zones.id, merchants.zoneId))
    .leftJoin(ownerCounts, eq(ownerCounts.merchantId, merchants.id))
    .orderBy(desc(merchants.createdAt));

  return rows.map((row) => ({
    ...row,
    ownerCount: Number(row.ownerCount ?? 0),
  }));
}

export async function findMerchantBySlug(
  slug: string,
): Promise<{ id: string } | null> {
  const db = getDb();
  const rows = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export async function findMerchantDetailById(
  merchantId: string,
): Promise<MerchantDetailRecord | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: merchants.id,
      name: merchants.name,
      slug: merchants.slug,
      description: merchants.description,
      status: merchants.status,
      cityId: merchants.cityId,
      zoneId: merchants.zoneId,
      cityName: cities.name,
      zoneName: zones.name,
      pickupEnabled: merchants.pickupEnabled,
      merchantDeliveryEnabled: merchants.merchantDeliveryEnabled,
      platformDeliveryEnabled: merchants.platformDeliveryEnabled,
      preparationMinutes: merchants.preparationMinutes,
      createdAt: merchants.createdAt,
      updatedAt: merchants.updatedAt,
    })
    .from(merchants)
    .innerJoin(cities, eq(cities.id, merchants.cityId))
    .innerJoin(zones, eq(zones.id, merchants.zoneId))
    .where(eq(merchants.id, merchantId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Returns merchant detail only if the user has an active membership.
 * Cross-merchant isolation: wrong merchantId yields null (caller maps to forbidden).
 */
export async function findMerchantDetailForMember(
  merchantId: string,
  userId: string,
): Promise<(MerchantDetailRecord & { role: string }) | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: merchants.id,
      name: merchants.name,
      slug: merchants.slug,
      description: merchants.description,
      status: merchants.status,
      cityId: merchants.cityId,
      zoneId: merchants.zoneId,
      cityName: cities.name,
      zoneName: zones.name,
      pickupEnabled: merchants.pickupEnabled,
      merchantDeliveryEnabled: merchants.merchantDeliveryEnabled,
      platformDeliveryEnabled: merchants.platformDeliveryEnabled,
      preparationMinutes: merchants.preparationMinutes,
      createdAt: merchants.createdAt,
      updatedAt: merchants.updatedAt,
      role: merchantUsers.role,
    })
    .from(merchants)
    .innerJoin(cities, eq(cities.id, merchants.cityId))
    .innerJoin(zones, eq(zones.id, merchants.zoneId))
    .innerJoin(
      merchantUsers,
      and(
        eq(merchantUsers.merchantId, merchants.id),
        eq(merchantUsers.userId, userId),
        eq(merchantUsers.active, true),
      ),
    )
    .where(eq(merchants.id, merchantId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listMerchantMembers(
  merchantId: string,
): Promise<MerchantMemberRecord[]> {
  const db = getDb();
  return db
    .select({
      id: merchantUsers.id,
      userId: merchantUsers.userId,
      role: merchantUsers.role,
      active: merchantUsers.active,
      displayName: userProfiles.displayName,
      createdAt: merchantUsers.createdAt,
    })
    .from(merchantUsers)
    .innerJoin(userProfiles, eq(userProfiles.id, merchantUsers.userId))
    .where(eq(merchantUsers.merchantId, merchantId))
    .orderBy(asc(merchantUsers.createdAt));
}

export async function insertMerchantDraft(
  input: InsertMerchantInput,
): Promise<MerchantDetailRecord> {
  const db = getDb();
  const inserted = await db
    .insert(merchants)
    .values({
      name: input.name,
      slug: input.slug,
      description: input.description,
      cityId: input.cityId,
      zoneId: input.zoneId,
      pickupEnabled: input.pickupEnabled,
      merchantDeliveryEnabled: input.merchantDeliveryEnabled,
      // Server-enforced onboarding invariants
      status: "DRAFT",
      platformDeliveryEnabled: false,
      preparationMinutes: input.preparationMinutes,
    })
    .returning({ id: merchants.id });

  const id = inserted[0]?.id;
  if (!id) {
    throw new Error("Failed to insert merchant");
  }

  const detail = await findMerchantDetailById(id);
  if (!detail) {
    throw new Error("Merchant inserted but not found");
  }
  return detail;
}

export async function listMembershipSummariesForUser(userId: string): Promise<
  Array<{
    merchantId: string;
    merchantName: string;
    role: string;
    active: boolean;
    merchantStatus: string;
    cityName: string;
    zoneName: string;
  }>
> {
  const db = getDb();
  return db
    .select({
      merchantId: merchantUsers.merchantId,
      merchantName: merchants.name,
      role: merchantUsers.role,
      active: merchantUsers.active,
      merchantStatus: merchants.status,
      cityName: cities.name,
      zoneName: zones.name,
    })
    .from(merchantUsers)
    .innerJoin(merchants, eq(merchants.id, merchantUsers.merchantId))
    .innerJoin(cities, eq(cities.id, merchants.cityId))
    .innerJoin(zones, eq(zones.id, merchants.zoneId))
    .where(
      and(eq(merchantUsers.userId, userId), eq(merchantUsers.active, true)),
    )
    .orderBy(asc(merchants.name));
}
