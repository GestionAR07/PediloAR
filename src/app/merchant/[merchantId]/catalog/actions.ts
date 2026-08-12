"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createMerchantCategoryApp,
  createOptionChoiceApp,
  createOptionGroupApp,
  createProductApp,
  deleteMerchantCategoryApp,
  reorderMerchantCategoryApp,
  toggleProductAvailabilityApp,
  updateMerchantCategoryApp,
  updateOptionChoiceApp,
  updateOptionGroupApp,
  updateProductApp,
} from "@/application/catalog/wiring";
import { productEditPath } from "@/lib/catalog-product-feedback";
import { isAuthzError } from "@/server/auth/errors";
import type { CatalogActionState } from "./action-state";

function catalogPath(merchantId: string, suffix = ""): string {
  return `/merchant/${merchantId}/catalog${suffix}`;
}

function revalidateCatalog(merchantId: string, suffix = ""): void {
  revalidatePath(catalogPath(merchantId, suffix));
  revalidatePath(catalogPath(merchantId));
}

function mapAuthzFailure(error: unknown): CatalogActionState {
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

export async function createCategoryAction(
  merchantId: string,
  formData: FormData,
): Promise<void> {
  try {
    const result = await createMerchantCategoryApp(merchantId, {
      name: String(formData.get("name") ?? ""),
    });
    if (!result.ok) {
      throw new Error(result.error.message);
    }
  } catch (error) {
    if (isAuthzError(error)) {
      throw new Error(mapAuthzFailure(error).error ?? "Error");
    }
    throw error instanceof Error
      ? error
      : new Error("Error al crear categoría");
  } finally {
    revalidateCatalog(merchantId, "/categories");
  }
}

export async function updateCategoryAction(
  merchantId: string,
  categoryId: string,
  formData: FormData,
): Promise<void> {
  try {
    const result = await updateMerchantCategoryApp(merchantId, categoryId, {
      name: String(formData.get("name") ?? ""),
      active: formData.get("active") === "on",
    });
    if (!result.ok) {
      throw new Error(result.error.message);
    }
  } catch (error) {
    if (isAuthzError(error)) {
      throw new Error(mapAuthzFailure(error).error ?? "Error");
    }
    throw error instanceof Error
      ? error
      : new Error("Error al actualizar categoría");
  } finally {
    revalidateCatalog(merchantId, "/categories");
  }
}

export async function reorderCategoryAction(
  merchantId: string,
  categoryId: string,
  direction: "up" | "down",
): Promise<void> {
  try {
    const result = await reorderMerchantCategoryApp(
      merchantId,
      categoryId,
      direction,
    );
    if (!result.ok) {
      throw new Error(result.error.message);
    }
  } catch (error) {
    if (isAuthzError(error)) {
      throw new Error(mapAuthzFailure(error).error ?? "Error");
    }
    throw error instanceof Error ? error : new Error("Error al reordenar");
  } finally {
    revalidateCatalog(merchantId, "/categories");
  }
}

export async function deleteCategoryAction(
  merchantId: string,
  categoryId: string,
): Promise<void> {
  try {
    const result = await deleteMerchantCategoryApp(merchantId, categoryId);
    if (!result.ok) {
      throw new Error(result.error.message);
    }
  } catch (error) {
    if (isAuthzError(error)) {
      throw new Error(mapAuthzFailure(error).error ?? "Error");
    }
    throw error instanceof Error ? error : new Error("Error al eliminar");
  } finally {
    revalidateCatalog(merchantId, "/categories");
  }
}

export async function createProductAction(
  merchantId: string,
  formData: FormData,
): Promise<void> {
  let productId: string;
  try {
    const stockMode = String(formData.get("stockMode") ?? "NOT_TRACKED");
    const stockRaw = formData.get("stockQuantity");
    const stockQuantity =
      stockRaw === null || stockRaw === "" ? null : Number(String(stockRaw));

    const result = await createProductApp(merchantId, {
      merchantCategoryId: String(formData.get("merchantCategoryId") ?? ""),
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      priceInput: String(formData.get("priceInput") ?? ""),
      stockMode,
      stockQuantity,
      active: formData.get("active") === "on",
      available: formData.get("available") !== "off",
    });

    if (!result.ok) {
      throw new Error(result.error.message);
    }
    productId = result.value.id;
  } catch (error) {
    if (isAuthzError(error)) {
      throw new Error(mapAuthzFailure(error).error ?? "Error");
    }
    throw error instanceof Error ? error : new Error("Error al crear producto");
  }
  redirect(productEditPath(merchantId, productId, "created"));
}

export async function updateProductAction(
  merchantId: string,
  productId: string,
  formData: FormData,
): Promise<void> {
  try {
    const stockMode = String(formData.get("stockMode") ?? "NOT_TRACKED");
    const stockRaw = formData.get("stockQuantity");
    const stockQuantity =
      stockRaw === null || stockRaw === "" ? null : Number(String(stockRaw));

    const result = await updateProductApp(merchantId, productId, {
      merchantCategoryId: String(formData.get("merchantCategoryId") ?? ""),
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      priceInput: String(formData.get("priceInput") ?? ""),
      stockMode,
      stockQuantity,
      active: formData.get("active") === "on",
      available: formData.get("available") === "on",
    });

    if (!result.ok) {
      throw new Error(result.error.message);
    }
  } catch (error) {
    if (isAuthzError(error)) {
      throw new Error(mapAuthzFailure(error).error ?? "Error");
    }
    throw error instanceof Error
      ? error
      : new Error("Error al actualizar producto");
  }
  revalidateCatalog(merchantId, `/products/${productId}`);
  redirect(productEditPath(merchantId, productId, "saved"));
}

export async function toggleProductAvailabilityAction(
  merchantId: string,
  productId: string,
): Promise<CatalogActionState> {
  try {
    const result = await toggleProductAvailabilityApp(merchantId, productId);
    if (!result.ok) {
      return { error: result.error.message, success: null };
    }
    revalidateCatalog(merchantId);
    return {
      error: null,
      success: result.value.available ? "Disponible" : "Sin stock",
    };
  } catch (error) {
    return mapAuthzFailure(error);
  }
}

export async function createOptionGroupAction(
  merchantId: string,
  productId: string,
  formData: FormData,
): Promise<void> {
  try {
    const result = await createOptionGroupApp(merchantId, {
      productId,
      name: String(formData.get("name") ?? ""),
      selectionMode: String(formData.get("selectionMode") ?? "SINGLE"),
      minSelections: formData.get("minSelections")
        ? Number(formData.get("minSelections"))
        : undefined,
      maxSelections: formData.get("maxSelections")
        ? Number(formData.get("maxSelections"))
        : undefined,
    });
    if (!result.ok) {
      throw new Error(result.error.message);
    }
  } catch (error) {
    if (isAuthzError(error)) {
      throw new Error(mapAuthzFailure(error).error ?? "Error");
    }
    throw error instanceof Error ? error : new Error("Error al crear grupo");
  } finally {
    revalidateCatalog(merchantId, `/products/${productId}`);
  }
}

export async function createOptionChoiceAction(
  merchantId: string,
  groupId: string,
  formData: FormData,
): Promise<void> {
  try {
    const result = await createOptionChoiceApp(merchantId, {
      groupId,
      name: String(formData.get("name") ?? ""),
      priceDeltaInput: String(formData.get("priceDeltaInput") ?? "0"),
    });
    if (!result.ok) {
      throw new Error(result.error.message);
    }
  } catch (error) {
    if (isAuthzError(error)) {
      throw new Error(mapAuthzFailure(error).error ?? "Error");
    }
    throw error instanceof Error ? error : new Error("Error al crear opción");
  } finally {
    revalidateCatalog(merchantId);
  }
}

export async function updateOptionGroupAction(
  merchantId: string,
  groupId: string,
  formData: FormData,
): Promise<void> {
  try {
    const result = await updateOptionGroupApp(merchantId, groupId, {
      name: String(formData.get("name") ?? ""),
      selectionMode: String(formData.get("selectionMode") ?? ""),
      minSelections: Number(formData.get("minSelections") ?? 0),
      maxSelections: Number(formData.get("maxSelections") ?? 1),
      active: formData.get("active") === "on",
    });
    if (!result.ok) {
      throw new Error(result.error.message);
    }
  } catch (error) {
    if (isAuthzError(error)) {
      throw new Error(mapAuthzFailure(error).error ?? "Error");
    }
    throw error instanceof Error
      ? error
      : new Error("Error al actualizar grupo");
  } finally {
    revalidateCatalog(merchantId);
  }
}

export async function updateOptionChoiceAction(
  merchantId: string,
  choiceId: string,
  formData: FormData,
): Promise<void> {
  try {
    const result = await updateOptionChoiceApp(merchantId, choiceId, {
      name: String(formData.get("name") ?? ""),
      priceDeltaInput: String(formData.get("priceDeltaInput") ?? "0"),
      active: formData.get("active") === "on",
    });
    if (!result.ok) {
      throw new Error(result.error.message);
    }
  } catch (error) {
    if (isAuthzError(error)) {
      throw new Error(mapAuthzFailure(error).error ?? "Error");
    }
    throw error instanceof Error
      ? error
      : new Error("Error al actualizar opción");
  } finally {
    revalidateCatalog(merchantId);
  }
}
