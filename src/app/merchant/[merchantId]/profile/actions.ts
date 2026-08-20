"use server";

import { revalidatePath } from "next/cache";
import {
  deleteMerchantCoverApp,
  upsertMerchantCoverApp,
} from "@/application/merchant/cover-image-wiring";
import { validateMerchantCoverFile } from "@/lib/merchant-cover-image";
import { isAuthzError } from "@/server/auth/errors";
import type { MerchantCoverActionState } from "./action-state";

function mapAuthzFailure(error: unknown): MerchantCoverActionState {
  if (isAuthzError(error)) {
    if (error.code === "UNAUTHENTICATED" || error.code === "CONFIG_MISSING") {
      return {
        error: "Tenés que iniciar sesión.",
        success: null,
      };
    }
    if (error.code === "USER_SUSPENDED") {
      return { error: "Tu cuenta está suspendida.", success: null };
    }
    return {
      error: "No tenés acceso a este comercio.",
      success: null,
    };
  }
  return {
    error: "No se pudo completar la operación.",
    success: null,
  };
}

function revalidateCover(merchantId: string): void {
  revalidatePath(`/merchant/${merchantId}/profile`);
  revalidatePath("/");
}

export async function upsertMerchantCoverAction(
  merchantId: string,
  formData: FormData,
): Promise<MerchantCoverActionState> {
  try {
    const file = formData.get("image");
    if (!(file instanceof File)) {
      return {
        error: "Seleccioná un archivo de imagen.",
        success: null,
      };
    }

    const earlyValidation = validateMerchantCoverFile({
      mimeType: file.type,
      sizeBytes: file.size,
    });
    if (earlyValidation) {
      return { error: earlyValidation.message, success: null };
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await upsertMerchantCoverApp(merchantId, {
      mimeType: file.type,
      sizeBytes: file.size,
      bytes,
    });

    if (!result.ok) {
      return { error: result.error.message, success: null };
    }

    revalidateCover(merchantId);
    return { error: null, success: "Portada guardada." };
  } catch (error) {
    return mapAuthzFailure(error);
  }
}

export async function deleteMerchantCoverAction(
  merchantId: string,
): Promise<MerchantCoverActionState> {
  try {
    const result = await deleteMerchantCoverApp(merchantId);
    if (!result.ok) {
      return { error: result.error.message, success: null };
    }

    revalidateCover(merchantId);
    return { error: null, success: "Portada eliminada." };
  } catch (error) {
    return mapAuthzFailure(error);
  }
}
