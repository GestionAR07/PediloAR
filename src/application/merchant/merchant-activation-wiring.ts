import "server-only";

import {
  activateMerchant,
  type ActivateMerchantDeps,
} from "@/application/merchant/activate-merchant";
import {
  activateMerchantDraftById,
  findMerchantActivationReadiness,
} from "@/infrastructure/db/repositories/merchant-activation-repository";
import { requirePlatformAdmin } from "@/server/auth/authorization";

function activationDeps(): ActivateMerchantDeps {
  return {
    requirePlatformAdmin: async () => {
      await requirePlatformAdmin();
    },
    findActivationReadiness: findMerchantActivationReadiness,
    activateDraftMerchant: activateMerchantDraftById,
  };
}

export async function activateMerchantApp(merchantId: string) {
  return activateMerchant(merchantId, activationDeps());
}
