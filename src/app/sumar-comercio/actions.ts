"use server";

import { submitMerchantApplicationApp } from "@/application/merchant/merchant-application-wiring";
import type { SubmitMerchantApplicationActionState } from "./action-state";

function mapDuplicateMessage(): SubmitMerchantApplicationActionState {
  return {
    error: "Ya recibimos una solicitud pendiente para ese comercio y email.",
    success: false,
  };
}

export async function submitMerchantApplicationAction(
  _prev: SubmitMerchantApplicationActionState,
  formData: FormData,
): Promise<SubmitMerchantApplicationActionState> {
  const result = await submitMerchantApplicationApp({
    businessName: String(formData.get("businessName") ?? ""),
    contactName: String(formData.get("contactName") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
    cityId: String(formData.get("cityId") ?? ""),
    zoneId: String(formData.get("zoneId") ?? ""),
    description: String(formData.get("description") ?? ""),
    message: String(formData.get("message") ?? ""),
  });

  if (!result.ok) {
    if (result.error.code === "PENDING_DUPLICATE") {
      return mapDuplicateMessage();
    }
    return { error: result.error.message, success: false };
  }

  return { error: null, success: true };
}
