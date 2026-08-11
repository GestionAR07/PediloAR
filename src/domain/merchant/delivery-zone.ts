import {
  assertNonNegativeMoneyCents,
  type MoneyCents,
} from "../money/money-cents";
import { DomainError } from "../shared/errors";
import { err, ok, type Result } from "../shared/result";
import type { ZoneId } from "../shared/ids";
import type { Merchant, MerchantDeliveryZone } from "./types";

/**
 * Applicable merchant-owned delivery configuration for a zone + order subtotal.
 *
 * Important semantics:
 * `merchantDeliveryEnabled = true` does NOT mean the merchant can deliver to
 * every customer. Checkout with own delivery also requires an active
 * MerchantDeliveryZone for the destination zone and subtotal ≥ minimumOrderCents.
 *
 * `platformDeliveryEnabled` remains blocked for checkout in MVP (see
 * assertFulfillmentAllowedForMvp). This function only covers merchant delivery.
 */
export type MerchantDeliveryEligibility = {
  zone: MerchantDeliveryZone;
  deliveryFeeCents: MoneyCents;
  minimumOrderCents: MoneyCents;
  estimatedMinutes: number;
};

export function resolveMerchantDeliveryForZone(
  merchant: Pick<Merchant, "merchantDeliveryEnabled">,
  zones: readonly MerchantDeliveryZone[],
  zoneId: ZoneId,
  orderSubtotalCents: MoneyCents,
): Result<MerchantDeliveryEligibility, DomainError> {
  assertNonNegativeMoneyCents(orderSubtotalCents);

  if (!merchant.merchantDeliveryEnabled) {
    return err(
      new DomainError(
        "MERCHANT_DELIVERY_DISABLED",
        "Merchant does not offer own delivery",
      ),
    );
  }

  const zone = zones.find((candidate) => candidate.zoneId === zoneId);

  if (zone == null) {
    return err(
      new DomainError(
        "MERCHANT_DELIVERY_ZONE_NOT_FOUND",
        "Merchant does not deliver to the requested zone",
      ),
    );
  }

  if (!zone.active) {
    return err(
      new DomainError(
        "MERCHANT_DELIVERY_ZONE_INACTIVE",
        "Merchant delivery zone is inactive",
      ),
    );
  }

  assertNonNegativeMoneyCents(zone.minimumOrderCents);
  assertNonNegativeMoneyCents(zone.deliveryFeeCents);

  if (orderSubtotalCents < zone.minimumOrderCents) {
    return err(
      new DomainError(
        "MERCHANT_DELIVERY_BELOW_MINIMUM",
        "Order subtotal is below the merchant delivery minimum for this zone",
      ),
    );
  }

  return ok({
    zone,
    deliveryFeeCents: zone.deliveryFeeCents,
    minimumOrderCents: zone.minimumOrderCents,
    estimatedMinutes: zone.estimatedMinutes,
  });
}
