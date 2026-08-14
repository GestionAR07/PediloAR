import "server-only";

import {
  MERCHANT_ORDER_ALLOWED_ROLES,
  acceptMerchantOrder,
  rejectMerchantOrder,
} from "@/application/merchant/order-actions";
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
