import "server-only";

import {
  pauseMerchantOrdersTemporarily as pauseMerchantOrdersTemporarilyUseCase,
  pauseMerchantOrdersUntilManualResume as pauseMerchantOrdersUntilManualResumeUseCase,
  resumeMerchantOrders as resumeMerchantOrdersUseCase,
  MERCHANT_OPERATIONAL_ALLOWED_ROLES,
} from "@/application/merchant/operational-availability";
import {
  findMerchantOperationalState,
  setMerchantOperationalState,
} from "@/infrastructure/db/repositories/merchant-repository";
import { requireMerchantRole } from "@/server/auth/authorization";

async function requireOperationalAccess(merchantId: string): Promise<void> {
  await requireMerchantRole(merchantId, MERCHANT_OPERATIONAL_ALLOWED_ROLES);
}

function operationalDeps() {
  return {
    requireOperationalAccess,
    findMerchantOperationalState,
    setMerchantOperationalState,
    now: () => new Date(),
  };
}

export async function pauseMerchantOrdersTemporarilyApp(
  merchantId: string,
  durationMinutes: number,
) {
  return pauseMerchantOrdersTemporarilyUseCase(
    merchantId,
    durationMinutes,
    operationalDeps(),
  );
}

export async function pauseMerchantOrdersUntilManualResumeApp(
  merchantId: string,
) {
  return pauseMerchantOrdersUntilManualResumeUseCase(
    merchantId,
    operationalDeps(),
  );
}

export async function resumeMerchantOrdersApp(merchantId: string) {
  return resumeMerchantOrdersUseCase(merchantId, operationalDeps());
}
