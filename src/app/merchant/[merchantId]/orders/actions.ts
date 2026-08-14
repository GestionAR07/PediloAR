"use server";

import { revalidatePath } from "next/cache";
import {
  acceptMerchantOrderApp,
  rejectMerchantOrderApp,
} from "@/application/merchant/order-actions-wiring";
import { isAuthzError } from "@/server/auth/errors";

export type MerchantOrderActionState = {
  ok: boolean;
  code: string | null;
  message: string | null;
};

function revalidateOrderPaths(merchantId: string, orderId: string): void {
  revalidatePath("/merchant");
  revalidatePath(`/merchant/${merchantId}`);
  revalidatePath(`/merchant/${merchantId}/orders/${orderId}`);
}

function mapFailure(error: unknown): MerchantOrderActionState {
  if (isAuthzError(error)) {
    if (error.code === "UNAUTHENTICATED" || error.code === "CONFIG_MISSING") {
      return {
        ok: false,
        code: error.code,
        message: "Tenés que iniciar sesión.",
      };
    }
    return {
      ok: false,
      code: error.code,
      message: "No tenés acceso a este comercio.",
    };
  }
  return {
    ok: false,
    code: "ORDER_PERSISTENCE_FAILED",
    message: "No se pudo actualizar el pedido.",
  };
}

export async function acceptMerchantOrderAction(
  merchantId: string,
  orderId: string,
): Promise<MerchantOrderActionState> {
  try {
    const result = await acceptMerchantOrderApp(merchantId, orderId);
    if (!result.ok) {
      return {
        ok: false,
        code: result.error.code,
        message: result.error.message,
      };
    }
    revalidateOrderPaths(merchantId, orderId);
    return { ok: true, code: null, message: null };
  } catch (error) {
    return mapFailure(error);
  }
}

export async function rejectMerchantOrderAction(
  merchantId: string,
  orderId: string,
  reason: string,
): Promise<MerchantOrderActionState> {
  try {
    const result = await rejectMerchantOrderApp(merchantId, orderId, reason);
    if (!result.ok) {
      return {
        ok: false,
        code: result.error.code,
        message: result.error.message,
      };
    }
    revalidateOrderPaths(merchantId, orderId);
    return { ok: true, code: null, message: null };
  } catch (error) {
    return mapFailure(error);
  }
}
