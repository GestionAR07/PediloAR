"use server";

import { revalidatePath } from "next/cache";
import { saveMerchantPaymentMethodsApp } from "@/application/merchant/payment-method-wiring";
import { isAuthzError } from "@/server/auth/errors";
import type { PaymentMethodActionState } from "./action-state";

function mapFailure(error: unknown): PaymentMethodActionState {
  if (isAuthzError(error)) {
    if (error.code === "UNAUTHENTICATED" || error.code === "CONFIG_MISSING") {
      return { error: "Tenés que iniciar sesión.", success: null };
    }
    return { error: "No tenés acceso a este comercio.", success: null };
  }
  return { error: "No pudimos guardar los cambios.", success: null };
}

export async function saveMerchantPaymentMethodsAction(
  merchantId: string,
  _prev: PaymentMethodActionState,
  formData: FormData,
): Promise<PaymentMethodActionState> {
  try {
    const result = await saveMerchantPaymentMethodsApp(merchantId, {
      CASH: {
        active: formData.get("active_CASH") === "on",
        instructions: String(formData.get("instructions_CASH") ?? ""),
      },
      TRANSFER: {
        active: formData.get("active_TRANSFER") === "on",
        instructions: String(formData.get("instructions_TRANSFER") ?? ""),
      },
      MERCADO_PAGO: {
        active: formData.get("active_MERCADO_PAGO") === "on",
        instructions: String(formData.get("instructions_MERCADO_PAGO") ?? ""),
      },
    });
    if (!result.ok) {
      return { error: result.error.message, success: null };
    }
    revalidatePath(`/merchant/${merchantId}/payment-methods`);
    revalidatePath(`/merchant/${merchantId}`);
    return { error: null, success: "Medios de pago actualizados." };
  } catch (error) {
    return mapFailure(error);
  }
}
