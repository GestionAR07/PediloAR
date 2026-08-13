import "server-only";

import {
  listMerchantPaymentMethodSettings as listMerchantPaymentMethodSettingsUseCase,
  saveMerchantPaymentMethods as saveMerchantPaymentMethodsUseCase,
  PAYMENT_METHOD_ALLOWED_ROLES,
  type SaveMerchantPaymentMethodsInput,
} from "@/application/merchant/payment-methods";
import {
  listMerchantPaymentMethods,
  upsertMerchantPaymentMethods,
} from "@/infrastructure/db/repositories/merchant-payment-method-repository";
import { requireMerchantRole } from "@/server/auth/authorization";

async function requirePaymentMethodAccess(merchantId: string): Promise<void> {
  await requireMerchantRole(merchantId, PAYMENT_METHOD_ALLOWED_ROLES);
}

function paymentMethodDeps() {
  return {
    requirePaymentMethodAccess,
    listPaymentMethods: listMerchantPaymentMethods,
    upsertPaymentMethods: upsertMerchantPaymentMethods,
  };
}

export async function listMerchantPaymentMethodSettingsApp(merchantId: string) {
  return listMerchantPaymentMethodSettingsUseCase(
    merchantId,
    paymentMethodDeps(),
  );
}

export async function saveMerchantPaymentMethodsApp(
  merchantId: string,
  input: SaveMerchantPaymentMethodsInput,
) {
  return saveMerchantPaymentMethodsUseCase(
    merchantId,
    input,
    paymentMethodDeps(),
  );
}
