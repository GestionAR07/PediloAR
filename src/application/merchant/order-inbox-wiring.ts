import "server-only";

import {
  MERCHANT_ORDER_ALLOWED_ROLES,
  getMerchantOrder as getMerchantOrderUseCase,
  listMerchantInbox as listMerchantInboxUseCase,
} from "@/application/merchant/order-inbox";
import { startOfLocalDay } from "@/lib/format-local-time";
import {
  findOrderForMerchant,
  listOrdersForMerchant,
} from "@/infrastructure/db/repositories/merchant-order-repository";
import { requireMerchantRole } from "@/server/auth/authorization";

async function requireMerchantOrderAccess(merchantId: string): Promise<void> {
  await requireMerchantRole(merchantId, MERCHANT_ORDER_ALLOWED_ROLES);
}

function inboxDeps() {
  return {
    requireMerchantOrderAccess,
    listOrdersForMerchant,
    findOrderForMerchant,
  };
}

export async function listMerchantInboxApp(
  merchantId: string,
  timeZone: string,
) {
  const terminalSince = startOfLocalDay(new Date(), timeZone);
  return listMerchantInboxUseCase(merchantId, terminalSince, inboxDeps());
}

export async function getMerchantOrderApp(merchantId: string, orderId: string) {
  return getMerchantOrderUseCase(merchantId, orderId, inboxDeps());
}
