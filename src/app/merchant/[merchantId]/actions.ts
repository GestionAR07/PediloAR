"use server";

import { revalidatePath } from "next/cache";
import {
  pauseMerchantOrdersTemporarilyApp,
  pauseMerchantOrdersUntilManualResumeApp,
  resumeMerchantOrdersApp,
} from "@/application/merchant/operational-wiring";
import { isAuthzError } from "@/server/auth/errors";

export type MerchantOperationalActionState = {
  error: string | null;
  success: string | null;
};

function merchantPath(merchantId: string): string {
  return `/merchant/${merchantId}`;
}

function mapFailure(error: unknown): MerchantOperationalActionState {
  if (isAuthzError(error)) {
    if (error.code === "UNAUTHENTICATED" || error.code === "CONFIG_MISSING") {
      return { error: "Tenés que iniciar sesión.", success: null };
    }
    return { error: "No tenés acceso a este comercio.", success: null };
  }
  return { error: "No se pudo completar la operación.", success: null };
}

export async function pauseMerchantOrdersTemporaryAction(
  merchantId: string,
  durationMinutes: number,
): Promise<MerchantOperationalActionState> {
  try {
    const result = await pauseMerchantOrdersTemporarilyApp(
      merchantId,
      durationMinutes,
    );
    if (!result.ok) {
      return { error: result.error.message, success: null };
    }
    revalidatePath(merchantPath(merchantId));
    return { error: null, success: "Pedidos pausados temporalmente." };
  } catch (error) {
    return mapFailure(error);
  }
}

export async function pauseMerchantOrdersManualAction(
  merchantId: string,
): Promise<MerchantOperationalActionState> {
  try {
    const result = await pauseMerchantOrdersUntilManualResumeApp(merchantId);
    if (!result.ok) {
      return { error: result.error.message, success: null };
    }
    revalidatePath(merchantPath(merchantId));
    return { error: null, success: "Pedidos pausados hasta reactivación." };
  } catch (error) {
    return mapFailure(error);
  }
}

export async function resumeMerchantOrdersAction(
  merchantId: string,
): Promise<MerchantOperationalActionState> {
  try {
    const result = await resumeMerchantOrdersApp(merchantId);
    if (!result.ok) {
      return { error: result.error.message, success: null };
    }
    revalidatePath(merchantPath(merchantId));
    return { error: null, success: "Pedidos reanudados." };
  } catch (error) {
    return mapFailure(error);
  }
}
