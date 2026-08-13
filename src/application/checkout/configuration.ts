import {
  getMerchantOperationalStatus,
  isMerchantOperationallyAcceptingOrders,
} from "@/domain/merchant/operational-availability";
import type { MerchantStatus } from "@/domain/merchant/enums";
import { getPublicMerchantAvailabilityPresentation } from "@/lib/public-merchant-availability";
import { isValidUuid } from "@/lib/uuid";
import type {
  CheckoutDeliveryZoneRecord,
  CheckoutMerchantRecord,
  CheckoutPaymentMethodRecord,
  PrepareOrderDeps,
} from "./types";

export type CheckoutConfigPayment = {
  code: string;
  label: string;
  instructions: string;
};

export type CheckoutConfigDeliveryZone = {
  zoneId: string;
  zoneName: string;
  cityName: string;
  feeCents: number;
  minimumOrderCents: number;
  estimatedMinutes: number;
};

export type CheckoutConfiguration = {
  merchant: {
    id: string;
    name: string;
    acceptingOrders: boolean;
    availabilityLabel: string;
    availabilityTone: "available" | "paused" | "unavailable";
    pickupEnabled: boolean;
    merchantDeliveryEnabled: boolean;
    homeZoneId: string;
    homeZoneName: string;
    homeCityName: string;
    preparationMinutes: number | null;
  };
  deliveryZones: CheckoutConfigDeliveryZone[];
  paymentMethods: CheckoutConfigPayment[];
};

export type CheckoutConfigurationDeps = Pick<
  PrepareOrderDeps,
  | "now"
  | "findMerchantById"
  | "listPaymentMethodsForMerchant"
  | "listDeliveryZonesForMerchant"
>;

function isSafeMerchant(row: CheckoutMerchantRecord): boolean {
  return Boolean(row.id && row.name);
}

export async function getCheckoutConfiguration(
  merchantId: string,
  deps: CheckoutConfigurationDeps,
): Promise<CheckoutConfiguration | null> {
  if (!isValidUuid(merchantId)) {
    return null;
  }

  const merchant = await deps.findMerchantById(merchantId);
  if (!merchant || !isSafeMerchant(merchant)) {
    return null;
  }

  const now = deps.now();
  const operational = getMerchantOperationalStatus(
    {
      status: merchant.status as MerchantStatus,
      acceptingOrders: merchant.acceptingOrders,
      pausedUntil: merchant.pausedUntil,
    },
    now,
  );
  const availability = getPublicMerchantAvailabilityPresentation(operational);
  const accepting = isMerchantOperationallyAcceptingOrders(
    {
      status: merchant.status as MerchantStatus,
      acceptingOrders: merchant.acceptingOrders,
      pausedUntil: merchant.pausedUntil,
    },
    now,
  );

  const [payments, zones] = await Promise.all([
    deps.listPaymentMethodsForMerchant(merchantId),
    merchant.merchantDeliveryEnabled
      ? deps.listDeliveryZonesForMerchant(merchantId)
      : Promise.resolve([] as CheckoutDeliveryZoneRecord[]),
  ]);

  return {
    merchant: {
      id: merchant.id,
      name: merchant.name,
      acceptingOrders: accepting,
      availabilityLabel: availability.label,
      availabilityTone: availability.tone,
      pickupEnabled: merchant.pickupEnabled,
      merchantDeliveryEnabled: merchant.merchantDeliveryEnabled,
      homeZoneId: merchant.zoneId,
      homeZoneName: merchant.zoneName,
      homeCityName: merchant.cityName,
      preparationMinutes:
        typeof merchant.preparationMinutes === "number"
          ? merchant.preparationMinutes
          : null,
    },
    deliveryZones: zones
      .filter((zone) => zone.active && zone.merchantId === merchantId)
      .map((zone) => ({
        zoneId: zone.zoneId,
        zoneName: zone.zoneName,
        cityName: zone.cityName,
        feeCents: zone.deliveryFeeCents,
        minimumOrderCents: zone.minimumOrderCents,
        estimatedMinutes: zone.estimatedMinutes,
      })),
    paymentMethods: payments
      .filter((method: CheckoutPaymentMethodRecord) => method.active)
      .map((method) => ({
        code: method.code,
        label: method.label,
        instructions: method.instructions,
      })),
  };
}
