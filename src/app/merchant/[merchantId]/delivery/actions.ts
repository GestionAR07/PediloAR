"use server";

import { revalidatePath } from "next/cache";
import { saveMerchantDeliverySettingsApp } from "@/application/merchant/delivery-wiring";
import { isAuthzError } from "@/server/auth/errors";
import type { DeliverySettingsActionState } from "./action-state";

function mapFailure(error: unknown): DeliverySettingsActionState {
  if (isAuthzError(error)) {
    if (error.code === "UNAUTHENTICATED" || error.code === "CONFIG_MISSING") {
      return { error: "Tenés que iniciar sesión.", success: null };
    }
    return { error: "No tenés acceso a este comercio.", success: null };
  }
  return { error: "No pudimos guardar los cambios.", success: null };
}

export async function saveMerchantDeliverySettingsAction(
  merchantId: string,
  _prev: DeliverySettingsActionState,
  formData: FormData,
): Promise<DeliverySettingsActionState> {
  try {
    const zoneIds = formData
      .getAll("zone_id")
      .map((value) => String(value))
      .filter((value) => value.length > 0);

    const result = await saveMerchantDeliverySettingsApp(merchantId, {
      merchantDeliveryEnabled:
        formData.get("merchant_delivery_enabled") === "on",
      zones: zoneIds.map((zoneId) => ({
        zoneId,
        active: formData.get(`active_${zoneId}`) === "on",
        feeInput: String(formData.get(`fee_${zoneId}`) ?? ""),
        minimumInput: String(formData.get(`minimum_${zoneId}`) ?? ""),
        estimatedMinutesInput: String(
          formData.get(`estimated_minutes_${zoneId}`) ?? "",
        ),
      })),
    });
    if (!result.ok) {
      return { error: result.error.message, success: null };
    }
    revalidatePath(`/merchant/${merchantId}/delivery`);
    revalidatePath(`/merchant/${merchantId}`);
    revalidatePath(`/comercios/${merchantId}`);
    revalidatePath("/");
    revalidatePath("/checkout");
    return { error: null, success: "Configuración de envíos actualizada." };
  } catch (error) {
    return mapFailure(error);
  }
}
