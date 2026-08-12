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
  now: () => Date;
};

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
    return { zones, selectedZone: null, merchants: [] };
  }

  const selected = await deps.findZoneById(zoneId);
  if (!selected) {
    return { zones, selectedZone: null, merchants: [] };
  }

  const merchants = await deps.listMerchantsServingZone(zoneId);
  const merchantIds = merchants.map((m) => m.id);
  const [deliveryRows, openingRows] = await Promise.all([
    deps.listDeliveryZonesForMerchants(merchantIds, zoneId),
    deps.listOpeningIntervalsForMerchants(merchantIds),
  ]);

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
    };
  });

  return {
    zones,
    selectedZone: toZoneOption(selected),
    merchants: cards,
  };
}
