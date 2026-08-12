import { moneyCents } from "@/domain/money/money-cents";
import { formatMoneyCentsArs } from "@/lib/format-money";
import type { PublicLogisticsPresentation } from "./types";

export type LogisticsSource = {
  merchantZoneId: string;
  customerZoneId: string;
  pickupEnabled: boolean;
  merchantDeliveryEnabled: boolean;
  preparationMinutes: number;
  deliveryForCustomerZone: {
    deliveryFeeCents: number;
    minimumOrderCents: number;
    estimatedMinutes: number;
  } | null;
};

export function buildPublicLogisticsPresentation(
  source: LogisticsSource,
): PublicLogisticsPresentation {
  const pickupAvailable =
    source.pickupEnabled && source.merchantZoneId === source.customerZoneId;
  const deliveryAvailable =
    source.merchantDeliveryEnabled && source.deliveryForCustomerZone != null;

  const delivery = source.deliveryForCustomerZone;

  return {
    pickupAvailable,
    deliveryAvailable,
    deliveryFeeLabel:
      deliveryAvailable && delivery
        ? `Envío ${formatMoneyCentsArs(moneyCents(delivery.deliveryFeeCents))}`
        : null,
    minimumOrderLabel:
      deliveryAvailable && delivery && delivery.minimumOrderCents > 0
        ? `Compra mínima ${formatMoneyCentsArs(moneyCents(delivery.minimumOrderCents))}`
        : null,
    estimatedMinutesLabel:
      deliveryAvailable && delivery ? `${delivery.estimatedMinutes} min` : null,
    preparationMinutesLabel:
      source.preparationMinutes > 0
        ? `Prep. ~${source.preparationMinutes} min`
        : null,
  };
}
