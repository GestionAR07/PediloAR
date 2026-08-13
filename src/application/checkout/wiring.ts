import "server-only";

import { prepareOrder } from "@/application/checkout/prepare-order";
import type { PrepareOrderInput } from "@/application/checkout/types";
import {
  findMerchantForCheckout,
  listDeliveryZonesForCheckout,
  listOptionChoicesForGroupsCheckout,
  listOptionGroupsForProductsCheckout,
  listPaymentMethodsForCheckout,
  listProductsByIdsForCheckout,
} from "@/infrastructure/db/repositories/checkout-repository";

/**
 * Read-only wiring for authoritative order preparation.
 * Does not persist Orders and is not a public Server Action.
 */
export async function prepareOrderApp(input: PrepareOrderInput) {
  return prepareOrder(input, {
    now: () => new Date(),
    findMerchantById: findMerchantForCheckout,
    listProductsByIds: listProductsByIdsForCheckout,
    listOptionGroupsForProducts: listOptionGroupsForProductsCheckout,
    listOptionChoicesForGroups: listOptionChoicesForGroupsCheckout,
    listPaymentMethodsForMerchant: listPaymentMethodsForCheckout,
    listDeliveryZonesForMerchant: listDeliveryZonesForCheckout,
  });
}
