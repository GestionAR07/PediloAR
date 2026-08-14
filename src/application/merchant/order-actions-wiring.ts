import "server-only";

import {
  MERCHANT_ORDER_ALLOWED_ROLES,
  acceptMerchantOrder,
  completeMerchantDelivery,
  completeMerchantPickupOrder,
  markMerchantOrderReady,
  rejectMerchantOrder,
  startMerchantDelivery,
  startPreparingMerchantOrder,
} from "@/application/merchant/order-actions";
import { completeMerchantPickupOrderInTransaction } from "@/infrastructure/db/repositories/merchant-order-completion-repository";
import {
  completeMerchantDeliveryInTransaction,
  startMerchantDeliveryInTransaction,
} from "@/infrastructure/db/repositories/merchant-order-delivery-repository";
import { transitionMerchantOrderInTransaction } from "@/infrastructure/db/repositories/merchant-order-transition-repository";
import { cancelOrderInTransaction } from "@/infrastructure/db/repositories/checkout-order-repository";
import { requireMerchantRole } from "@/server/auth/authorization";

async function requireMerchantOrderAccess(merchantId: string): Promise<void> {
  await requireMerchantRole(merchantId, MERCHANT_ORDER_ALLOWED_ROLES);
}

function actionDeps() {
  return {
    now: () => new Date(),
    requireMerchantOrderAccess,
    transitionMerchantOrderInTransaction,
    cancelOrderInTransaction,
    completeMerchantPickupOrderInTransaction,
    startMerchantDeliveryInTransaction,
    completeMerchantDeliveryInTransaction,
  };
}

export async function acceptMerchantOrderApp(
  merchantId: string,
  orderId: string,
) {
  const context = await requireMerchantRole(
    merchantId,
    MERCHANT_ORDER_ALLOWED_ROLES,
  );
  return acceptMerchantOrder(
    {
      merchantId,
      orderId,
      actorUserId: context.user.id,
    },
    actionDeps(),
  );
}

export async function rejectMerchantOrderApp(
  merchantId: string,
  orderId: string,
  reason: string,
) {
  const context = await requireMerchantRole(
    merchantId,
    MERCHANT_ORDER_ALLOWED_ROLES,
  );
  return rejectMerchantOrder(
    {
      merchantId,
      orderId,
      actorUserId: context.user.id,
      reason,
    },
    actionDeps(),
  );
}

export async function startPreparingMerchantOrderApp(
  merchantId: string,
  orderId: string,
) {
  const context = await requireMerchantRole(
    merchantId,
    MERCHANT_ORDER_ALLOWED_ROLES,
  );
  return startPreparingMerchantOrder(
    {
      merchantId,
      orderId,
      actorUserId: context.user.id,
    },
    actionDeps(),
  );
}

export async function markMerchantOrderReadyApp(
  merchantId: string,
  orderId: string,
) {
  const context = await requireMerchantRole(
    merchantId,
    MERCHANT_ORDER_ALLOWED_ROLES,
  );
  return markMerchantOrderReady(
    {
      merchantId,
      orderId,
      actorUserId: context.user.id,
    },
    actionDeps(),
  );
}

export async function completeMerchantPickupOrderApp(
  merchantId: string,
  orderId: string,
) {
  const context = await requireMerchantRole(
    merchantId,
    MERCHANT_ORDER_ALLOWED_ROLES,
  );
  return completeMerchantPickupOrder(
    {
      merchantId,
      orderId,
      actorUserId: context.user.id,
    },
    actionDeps(),
  );
}

export async function startMerchantDeliveryApp(
  merchantId: string,
  orderId: string,
) {
  const context = await requireMerchantRole(
    merchantId,
    MERCHANT_ORDER_ALLOWED_ROLES,
  );
  return startMerchantDelivery(
    {
      merchantId,
      orderId,
      actorUserId: context.user.id,
    },
    actionDeps(),
  );
}

export async function completeMerchantDeliveryApp(
  merchantId: string,
  orderId: string,
) {
  const context = await requireMerchantRole(
    merchantId,
    MERCHANT_ORDER_ALLOWED_ROLES,
  );
  return completeMerchantDelivery(
    {
      merchantId,
      orderId,
      actorUserId: context.user.id,
    },
    actionDeps(),
  );
}
