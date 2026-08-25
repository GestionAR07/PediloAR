import "server-only";

import { getCheckoutConfiguration } from "@/application/checkout/configuration";
import { placeOrder } from "@/application/checkout/place-order";
import { cancelOrder } from "@/application/checkout/cancel-order";
import { prepareOrder } from "@/application/checkout/prepare-order";
import { reviewCheckout } from "@/application/checkout/review-checkout";
import type {
  CancelOrderInput,
  PrepareOrderInput,
} from "@/application/checkout/types";
import {
  cancelOrderInTransaction,
  findOrderByIdempotencyKey,
  persistPreparedOrderInTransaction,
} from "@/infrastructure/db/repositories/checkout-order-repository";
import {
  findMerchantForCheckout,
  listDeliveryZonesForCheckout,
  listOptionChoicesForGroupsCheckout,
  listOptionGroupsForProductsCheckout,
  listPaymentMethodsForCheckout,
  listProductsByIdsForCheckout,
} from "@/infrastructure/db/repositories/checkout-repository";

function prepareDeps() {
  return {
    now: () => new Date(),
    findMerchantById: findMerchantForCheckout,
    listProductsByIds: listProductsByIdsForCheckout,
    listOptionGroupsForProducts: listOptionGroupsForProductsCheckout,
    listOptionChoicesForGroups: listOptionChoicesForGroupsCheckout,
    listPaymentMethodsForMerchant: listPaymentMethodsForCheckout,
    listDeliveryZonesForMerchant: listDeliveryZonesForCheckout,
  };
}

/**
 * Read-only wiring for authoritative order preparation.
 * Does not persist Orders and is not a public Server Action.
 */
export async function prepareOrderApp(input: PrepareOrderInput) {
  return prepareOrder(input, prepareDeps());
}

export async function getCheckoutConfigurationApp(merchantId: string) {
  return getCheckoutConfiguration(merchantId, prepareDeps());
}

/**
 * Read-only authoritative review. Does not persist Orders.
 */
export async function reviewCheckoutApp(input: PrepareOrderInput) {
  return reviewCheckout(input, prepareDeps());
}

/**
 * Transactional order placement. Not a public Server Action.
 */
export async function placeOrderApp(
  input: PrepareOrderInput,
  customerUserId: string,
) {
  const deps = prepareDeps();
  return placeOrder(
    input,
    {
      ...deps,
      findOrderByIdempotencyKey,
      persistPreparedOrder: (prepared) =>
        persistPreparedOrderInTransaction(prepared, deps.now()),
    },
    { customerUserId },
  );
}

/**
 * Transactional order cancellation + TRACKED restock. Not a public Server Action.
 */
export async function cancelOrderApp(input: CancelOrderInput) {
  return cancelOrder(input, {
    now: () => new Date(),
    cancelOrderInTransaction,
  });
}
