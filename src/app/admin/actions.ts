"use server";

import { activateMerchantApp } from "@/application/merchant/merchant-activation-wiring";
import {
  createCityApp,
  createMerchantApp,
  createProvinceApp,
  createZoneApp,
  inviteMerchantOwnerApp,
} from "@/application/merchant/wiring";
import { isAuthzError } from "@/server/auth/errors";
import type { ActionState, CreateMerchantActionState } from "./action-state";

function mapAuthzFailure(error: unknown): ActionState {
  if (isAuthzError(error)) {
    if (error.code === "UNAUTHENTICATED" || error.code === "CONFIG_MISSING") {
      return {
        error: "Tenés que iniciar sesión como administrador.",
        success: null,
      };
    }
    if (error.code === "USER_SUSPENDED") {
      return { error: "Tu cuenta está suspendida.", success: null };
    }
    return {
      error: "No tenés acceso a esa sección.",
      success: null,
    };
  }
  return {
    error: "No se pudo completar la operación.",
    success: null,
  };
}

export async function createProvinceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const result = await createProvinceApp({
      name: String(formData.get("name") ?? ""),
      code: String(formData.get("code") ?? ""),
    });
    if (!result.ok) {
      return { error: result.error.message, success: null };
    }
    return { error: null, success: "Provincia creada." };
  } catch (error) {
    return mapAuthzFailure(error);
  }
}

export async function createCityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const result = await createCityApp({
      provinceId: String(formData.get("provinceId") ?? ""),
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      timezone: String(formData.get("timezone") ?? ""),
    });
    if (!result.ok) {
      return { error: result.error.message, success: null };
    }
    return { error: null, success: "Ciudad creada." };
  } catch (error) {
    return mapAuthzFailure(error);
  }
}

export async function createZoneAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const result = await createZoneApp({
      cityId: String(formData.get("cityId") ?? ""),
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
    });
    if (!result.ok) {
      return { error: result.error.message, success: null };
    }
    return { error: null, success: "Zona creada." };
  } catch (error) {
    return mapAuthzFailure(error);
  }
}

export async function createMerchantActionWithId(
  _prev: CreateMerchantActionState,
  formData: FormData,
): Promise<CreateMerchantActionState> {
  try {
    const preparationRaw = String(formData.get("preparationMinutes") ?? "30");
    const preparationMinutes = Number.parseInt(preparationRaw, 10);

    const result = await createMerchantApp({
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      description: String(formData.get("description") ?? ""),
      cityId: String(formData.get("cityId") ?? ""),
      zoneId: String(formData.get("zoneId") ?? ""),
      pickupEnabled: formData.get("pickupEnabled") === "on",
      merchantDeliveryEnabled: formData.get("merchantDeliveryEnabled") === "on",
      preparationMinutes: Number.isFinite(preparationMinutes)
        ? preparationMinutes
        : -1,
      status: String(formData.get("status") ?? "ACTIVE"),
      platformDeliveryEnabled: formData.get("platformDeliveryEnabled") === "on",
    });

    if (!result.ok) {
      return { error: result.error.message, success: null };
    }

    return {
      error: null,
      success: "Comercio creado.",
      merchantId: result.value.id,
    };
  } catch (error) {
    return { ...mapAuthzFailure(error) };
  }
}

export async function inviteOwnerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const result = await inviteMerchantOwnerApp({
      merchantId: String(formData.get("merchantId") ?? ""),
      email: String(formData.get("email") ?? ""),
      displayName: String(formData.get("displayName") ?? "") || undefined,
    });

    if (!result.ok) {
      return { error: result.error.message, success: null };
    }

    return { error: null, success: result.value.message };
  } catch (error) {
    return mapAuthzFailure(error);
  }
}

export async function activateMerchantAction(
  merchantId: string,
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    const result = await activateMerchantApp(merchantId);
    if (!result.ok) {
      return { error: result.error.message, success: null };
    }

    return {
      error: null,
      success: result.value.alreadyActive
        ? "El comercio ya estaba activo."
        : "Comercio activado. Ya puede aparecer en Pedilo.",
    };
  } catch (error) {
    return mapAuthzFailure(error);
  }
}
