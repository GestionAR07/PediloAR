import {
  getMerchantOperationalStatus,
  type MerchantOperationalFields,
} from "@/domain/merchant/operational-availability";
import type { MerchantStatus } from "@/domain/merchant/enums";
import type { MerchantOpeningInterval } from "@/domain/merchant/types";
import { getPublicHoursPresentation } from "@/lib/public-hours";
import { getPublicMerchantAvailabilityPresentation } from "@/lib/public-merchant-availability";
import { isValidUuid } from "@/lib/uuid";
import { buildPublicLogisticsPresentation } from "./logistics";
import type {
  PublicDiscoveryResult,
  PublicMarketplaceCategory,
  PublicMerchantCard,
  PublicZoneOption,
} from "./types";

export type DiscoveryZoneRecord = {
  id: string;
  name: string;
  cityName: string;
  cityTimezone: string;
};

export type DiscoveryMerchantRecord = {
  id: string;
  name: string;
  description: string;
  status: string;
  zoneId: string;
  zoneName: string;
  cityTimezone: string;
  pickupEnabled: boolean;
  merchantDeliveryEnabled: boolean;
  preparationMinutes: number;
  acceptingOrders: boolean;
  pausedUntil: Date | null;
  coverImagePath: string | null;
};

export type DiscoveryDeliveryRecord = {
  merchantId: string;
  zoneId: string;
  deliveryFeeCents: number;
  minimumOrderCents: number;
  estimatedMinutes: number;
  active: boolean;
};

export type DiscoveryOpeningRecord = {
  merchantId: string;
  weekday: number;
  openMinute: number;
  closeMinute: number;
};

export type DiscoveryCategoryLinkRecord = {
  merchantId: string;
  categoryId: string;
  name: string;
  slug: string;
  sortOrder: number;
  active: boolean;
};

export type GetPublicDiscoveryDeps = {
  listZones: () => Promise<DiscoveryZoneRecord[]>;
  findZoneById: (zoneId: string) => Promise<DiscoveryZoneRecord | null>;
  listMerchantsServingZone: (
    zoneId: string,
  ) => Promise<DiscoveryMerchantRecord[]>;
  listDeliveryZonesForMerchants: (
    merchantIds: string[],
    customerZoneId: string,
  ) => Promise<DiscoveryDeliveryRecord[]>;
  listOpeningIntervalsForMerchants: (
    merchantIds: string[],
  ) => Promise<DiscoveryOpeningRecord[]>;
  listMarketplaceCategoryLinksForMerchants: (
    merchantIds: string[],
  ) => Promise<DiscoveryCategoryLinkRecord[]>;
  createCoverSignedUrls: (
    imagePaths: readonly string[],
  ) => Promise<Map<string, string>>;
  now: () => Date;
};

const emptyDiscovery = (
  zones: PublicZoneOption[],
  selectedZone: PublicZoneOption | null = null,
): PublicDiscoveryResult => ({
  zones,
  selectedZone,
  merchants: [],
  categories: [],
});

type AssembledCategory = PublicMarketplaceCategory & { sortOrder: number };

/**
 * Unique active categories linked to the already-loaded public merchants.
 * Ordered by sort_order, then name, then id. Never includes empty taxonomy.
 */
export function assemblePublicMarketplaceCategories(
  links: readonly DiscoveryCategoryLinkRecord[],
): {
  categories: PublicMarketplaceCategory[];
  categoryIdsByMerchantId: Map<string, string[]>;
} {
  const categoryById = new Map<string, AssembledCategory>();
  const categoryIdsByMerchantId = new Map<string, string[]>();

  for (const link of links) {
    if (!link.active) {
      continue;
    }
    if (!categoryById.has(link.categoryId)) {
      categoryById.set(link.categoryId, {
        id: link.categoryId,
        name: link.name,
        slug: link.slug,
        sortOrder: link.sortOrder,
      });
    }
    const ids = categoryIdsByMerchantId.get(link.merchantId) ?? [];
    if (!ids.includes(link.categoryId)) {
      ids.push(link.categoryId);
      categoryIdsByMerchantId.set(link.merchantId, ids);
    }
  }

  const categories = [...categoryById.values()]
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      const byName = a.name.localeCompare(b.name, "es");
      if (byName !== 0) {
        return byName;
      }
      return a.id.localeCompare(b.id);
    })
    .map((category): PublicMarketplaceCategory => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
    }));

  const order = new Map(
    categories.map((category, index) => [category.id, index]),
  );
  for (const [merchantId, ids] of categoryIdsByMerchantId) {
    categoryIdsByMerchantId.set(
      merchantId,
      [...ids].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)),
    );
  }

  return { categories, categoryIdsByMerchantId };
}

function toZoneOption(zone: DiscoveryZoneRecord): PublicZoneOption {
  return {
    id: zone.id,
    name: zone.name,
    cityName: zone.cityName,
  };
}

export async function getPublicDiscovery(
  selectedZoneId: string | null | undefined,
  deps: GetPublicDiscoveryDeps,
): Promise<PublicDiscoveryResult> {
  const zones = (await deps.listZones()).map(toZoneOption);
  const zoneId =
    selectedZoneId && isValidUuid(selectedZoneId) ? selectedZoneId : null;

  if (!zoneId) {
    return emptyDiscovery(zones);
  }

  const selected = await deps.findZoneById(zoneId);
  if (!selected) {
    return emptyDiscovery(zones);
  }

  const merchants = await deps.listMerchantsServingZone(zoneId);
  const merchantIds = merchants.map((m) => m.id);
  const coverPaths = merchants
    .map((merchant) => merchant.coverImagePath)
    .filter((path): path is string => Boolean(path));
  const [deliveryRows, openingRows, coverUrls, categoryLinks] =
    await Promise.all([
      deps.listDeliveryZonesForMerchants(merchantIds, zoneId),
      deps.listOpeningIntervalsForMerchants(merchantIds),
      deps.createCoverSignedUrls(coverPaths),
      deps.listMarketplaceCategoryLinksForMerchants(merchantIds),
    ]);
  const { categories, categoryIdsByMerchantId } =
    assemblePublicMarketplaceCategories(categoryLinks);

  const now = deps.now();
  const cards: PublicMerchantCard[] = merchants.map((merchant) => {
    const operationalStatus = getMerchantOperationalStatus(
      {
        status: merchant.status as MerchantStatus,
        acceptingOrders: merchant.acceptingOrders,
        pausedUntil: merchant.pausedUntil,
      } satisfies MerchantOperationalFields,
      now,
    );
    const availability =
      getPublicMerchantAvailabilityPresentation(operationalStatus);

    const delivery = deliveryRows.find(
      (row) => row.merchantId === merchant.id && row.active,
    );

    const intervals = openingRows
      .filter((row) => row.merchantId === merchant.id)
      .map((row): MerchantOpeningInterval => ({
        merchantId: row.merchantId,
        weekday: row.weekday as MerchantOpeningInterval["weekday"],
        openMinute: row.openMinute,
        closeMinute: row.closeMinute,
      }));

    const hours = getPublicHoursPresentation({
      intervals,
      timezone: merchant.cityTimezone,
      now,
    });

    return {
      id: merchant.id,
      name: merchant.name,
      zoneName: merchant.zoneName,
      description: merchant.description,
      availabilityLabel: availability.label,
      availabilityTone: availability.tone,
      hoursLabel: hours?.label ?? null,
      hoursDetail: hours?.detail ?? null,
      logistics: buildPublicLogisticsPresentation({
        merchantZoneId: merchant.zoneId,
        customerZoneId: zoneId,
        pickupEnabled: merchant.pickupEnabled,
        merchantDeliveryEnabled: merchant.merchantDeliveryEnabled,
        preparationMinutes: merchant.preparationMinutes,
        deliveryForCustomerZone: delivery
          ? {
              deliveryFeeCents: delivery.deliveryFeeCents,
              minimumOrderCents: delivery.minimumOrderCents,
              estimatedMinutes: delivery.estimatedMinutes,
            }
          : null,
      }),
      href: `/comercios/${merchant.id}`,
      categoryIds: categoryIdsByMerchantId.get(merchant.id) ?? [],
      coverUrl: merchant.coverImagePath
        ? (coverUrls.get(merchant.coverImagePath) ?? null)
        : null,
    };
  });

  return {
    zones,
    selectedZone: toZoneOption(selected),
    merchants: cards,
    categories,
  };
}
