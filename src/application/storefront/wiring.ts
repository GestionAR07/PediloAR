import "server-only";

import { getPublicDiscovery } from "@/application/storefront/discovery";
import { getPublicMerchantCatalog } from "@/application/storefront/merchant-catalog";
import type { PublicNavContext } from "@/application/storefront/types";
import { hasDatabaseConfig } from "@/infrastructure/db/env";
import {
  findActivePublicMerchantById,
  findPublicZoneById,
  listActiveDeliveryZonesForMerchants,
  listActiveMerchantsServingZone,
  listActivePaymentMethodsForMerchant,
  listOpeningIntervalsForMerchant,
  listOpeningIntervalsForMerchants,
  listPublicActiveCategoriesForMerchant,
  listPublicActiveOptionChoicesForGroups,
  listPublicActiveOptionGroupsForProducts,
  listPublicActiveProductsForMerchant,
  listPublicZoneOptions,
} from "@/infrastructure/db/repositories/storefront-repository";
import { createMerchantCoverSignedUrls } from "@/infrastructure/storage/merchant-images";
import { createProductImageSignedUrls } from "@/infrastructure/storage/product-images";
import { hasSupabasePublicConfig } from "@/infrastructure/supabase/env";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { getDb } from "@/infrastructure/db/client";
import {
  merchantUsers,
  merchants,
  userProfiles,
} from "@/infrastructure/db/schema";
import { and, eq } from "drizzle-orm";

export async function getPublicDiscoveryApp(selectedZoneId?: string | null) {
  if (!hasDatabaseConfig()) {
    return { zones: [], selectedZone: null, merchants: [] };
  }

  return getPublicDiscovery(selectedZoneId, {
    listZones: async () => {
      const rows = await listPublicZoneOptions();
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        cityName: row.cityName,
        cityTimezone: row.cityTimezone,
      }));
    },
    findZoneById: async (zoneId) => {
      const row = await findPublicZoneById(zoneId);
      if (!row) return null;
      return {
        id: row.id,
        name: row.name,
        cityName: row.cityName,
        cityTimezone: row.cityTimezone,
      };
    },
    listMerchantsServingZone: listActiveMerchantsServingZone,
    listDeliveryZonesForMerchants: listActiveDeliveryZonesForMerchants,
    listOpeningIntervalsForMerchants,
    createCoverSignedUrls: async (paths) => {
      try {
        return await createMerchantCoverSignedUrls(paths);
      } catch {
        return new Map();
      }
    },
    now: () => new Date(),
  });
}

export async function getPublicMerchantCatalogApp(
  merchantId: string,
  customerZoneId?: string | null,
) {
  if (!hasDatabaseConfig()) {
    return null;
  }

  return getPublicMerchantCatalog(merchantId, customerZoneId, {
    findActiveMerchantById: findActivePublicMerchantById,
    listActiveCategories: listPublicActiveCategoriesForMerchant,
    listActiveProducts: listPublicActiveProductsForMerchant,
    listActiveOptionGroups: listPublicActiveOptionGroupsForProducts,
    listActiveOptionChoices: listPublicActiveOptionChoicesForGroups,
    listDeliveryZones: async (id, zoneId) =>
      listActiveDeliveryZonesForMerchants([id], zoneId),
    listPaymentMethods: listActivePaymentMethodsForMerchant,
    listOpeningIntervals: listOpeningIntervalsForMerchant,
    createSignedUrls: async (paths) => {
      try {
        return await createProductImageSignedUrls(paths);
      } catch {
        return new Map();
      }
    },
    now: () => new Date(),
  });
}

/**
 * Soft nav context for the public header. Never throws; guests get defaults.
 */
export async function getPublicNavContextApp(): Promise<PublicNavContext> {
  const empty: PublicNavContext = {
    isAuthenticated: false,
    isAdmin: false,
    merchantHomeHref: null,
  };

  if (!hasSupabasePublicConfig() || !hasDatabaseConfig()) {
    return empty;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return empty;
    }

    const db = getDb();
    const profileRows = await db
      .select({
        platformRole: userProfiles.platformRole,
        status: userProfiles.status,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, data.user.id))
      .limit(1);
    const profile = profileRows[0];
    if (!profile || profile.status !== "ACTIVE") {
      return { isAuthenticated: true, isAdmin: false, merchantHomeHref: null };
    }

    const membershipRows = await db
      .select({ merchantId: merchantUsers.merchantId })
      .from(merchantUsers)
      .innerJoin(merchants, eq(merchants.id, merchantUsers.merchantId))
      .where(
        and(
          eq(merchantUsers.userId, data.user.id),
          eq(merchantUsers.active, true),
        ),
      )
      .limit(1);

    return {
      isAuthenticated: true,
      isAdmin: profile.platformRole === "ADMIN",
      merchantHomeHref: membershipRows[0]
        ? `/merchant/${membershipRows[0].merchantId}`
        : null,
    };
  } catch {
    return empty;
  }
}
