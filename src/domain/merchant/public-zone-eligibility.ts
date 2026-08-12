import type { MerchantStatus } from "./enums";

export type PublicZoneMerchantCandidate = {
  id: string;
  status: MerchantStatus | string;
  zoneId: string;
  pickupEnabled: boolean;
  merchantDeliveryEnabled: boolean;
};

export type PublicDeliveryZoneLink = {
  merchantId: string;
  zoneId: string;
  active: boolean;
};

/**
 * Whether an ACTIVE merchant can appear in public discovery for a customer zone.
 * Pickup: merchant home zone matches. Delivery: active merchant_delivery_zones row.
 */
export function merchantServesCustomerZone(
  merchant: PublicZoneMerchantCandidate,
  customerZoneId: string,
  deliveryLinks: readonly PublicDeliveryZoneLink[],
): boolean {
  if (merchant.status !== "ACTIVE") {
    return false;
  }

  if (merchant.pickupEnabled && merchant.zoneId === customerZoneId) {
    return true;
  }

  if (!merchant.merchantDeliveryEnabled) {
    return false;
  }

  return deliveryLinks.some(
    (link) =>
      link.merchantId === merchant.id &&
      link.zoneId === customerZoneId &&
      link.active,
  );
}

export function isPubliclyListableMerchantStatus(
  status: MerchantStatus | string,
): boolean {
  return status === "ACTIVE";
}
