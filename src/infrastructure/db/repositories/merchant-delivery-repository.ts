import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { moneyCents } from "@/domain/money/money-cents";
import { getDb } from "../client";
import { cities, merchantDeliveryZones, merchants, zones } from "../schema";

export type MerchantDeliveryZoneRecord = {
  merchantId: string;
  zoneId: string;
  zoneName: string;
  cityName: string;
  deliveryFeeCents: number;
  minimumOrderCents: number;
  estimatedMinutes: number;
  active: boolean;
};

export type UpsertMerchantDeliveryZoneInput = {
  zoneId: string;
  deliveryFeeCents: number;
  minimumOrderCents: number;
  estimatedMinutes: number;
  active: boolean;
};

const RETURNING = {
  merchantId: merchantDeliveryZones.merchantId,
  zoneId: merchantDeliveryZones.zoneId,
  deliveryFeeCents: merchantDeliveryZones.deliveryFeeCents,
  minimumOrderCents: merchantDeliveryZones.minimumOrderCents,
  estimatedMinutes: merchantDeliveryZones.estimatedMinutes,
  active: merchantDeliveryZones.active,
};

export async function listMerchantDeliveryZones(
  merchantId: string,
): Promise<MerchantDeliveryZoneRecord[]> {
  const db = getDb();
  const rows = await db
    .select({
      merchantId: merchantDeliveryZones.merchantId,
      zoneId: merchantDeliveryZones.zoneId,
      zoneName: zones.name,
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

/**
 * Updates merchant_delivery_enabled and upserts zone rows in one transaction.
 * UNIQUE(merchant_id, zone_id) prevents duplicates. Inactive rows keep fee,
 * minimum and ETA. Does not touch platform_delivery_enabled or pickup.
 */
export async function saveMerchantDeliverySettings(
  merchantId: string,
  input: {
    merchantDeliveryEnabled: boolean;
    zones: readonly UpsertMerchantDeliveryZoneInput[];
  },
): Promise<MerchantDeliveryZoneRecord[]> {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx
      .update(merchants)
      .set({
        merchantDeliveryEnabled: input.merchantDeliveryEnabled,
        updatedAt: new Date(),
      })
      .where(eq(merchants.id, merchantId));

    for (const zone of input.zones) {
      const existing = await tx
        .select({ id: merchantDeliveryZones.id })
        .from(merchantDeliveryZones)
        .where(
          and(
            eq(merchantDeliveryZones.merchantId, merchantId),
            eq(merchantDeliveryZones.zoneId, zone.zoneId),
          ),
        )
        .limit(1);

      const values = {
        deliveryFeeCents: moneyCents(zone.deliveryFeeCents),
        minimumOrderCents: moneyCents(zone.minimumOrderCents),
        estimatedMinutes: zone.estimatedMinutes,
        active: zone.active,
        updatedAt: new Date(),
      };

      if (existing[0]) {
        const updated = await tx
          .update(merchantDeliveryZones)
          .set(values)
          .where(eq(merchantDeliveryZones.id, existing[0].id))
          .returning(RETURNING);
        if (!updated[0]) {
          throw new Error("Failed to update merchant delivery zone");
        }
        continue;
      }

      const inserted = await tx
        .insert(merchantDeliveryZones)
        .values({
          merchantId,
          zoneId: zone.zoneId,
          ...values,
        })
        .returning(RETURNING);
      if (!inserted[0]) {
        throw new Error("Failed to insert merchant delivery zone");
      }
    }

    const rows = await tx
      .select({
        merchantId: merchantDeliveryZones.merchantId,
        zoneId: merchantDeliveryZones.zoneId,
        zoneName: zones.name,
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
  });
}
