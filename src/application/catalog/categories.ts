import { err, ok, type Result } from "@/domain/shared/result";
import type { CatalogApplicationError, CatalogAuthDeps } from "./types";

export type CategoryDeps = CatalogAuthDeps & {
  findMerchantCategoryById: (
    merchantId: string,
    categoryId: string,
  ) => Promise<{
    id: string;
    name: string;
    sortOrder: number;
    active: boolean;
  } | null>;
  countProductsInCategory: (
    merchantId: string,
    categoryId: string,
  ) => Promise<number>;
  nextCategorySortOrder: (merchantId: string) => Promise<number>;
  insertMerchantCategory: (input: {
    merchantId: string;
    name: string;
    sortOrder: number;
    active?: boolean;
  }) => Promise<{ id: string }>;
  updateMerchantCategory: (
    merchantId: string,
    categoryId: string,
    patch: { name?: string; active?: boolean },
  ) => Promise<{ id: string } | null>;
  deleteMerchantCategory: (
    merchantId: string,
    categoryId: string,
  ) => Promise<boolean>;
  swapCategorySortOrder: (
    merchantId: string,
    categoryId: string,
    direction: "up" | "down",
  ) => Promise<boolean>;
  isUniqueViolation: (error: unknown) => boolean;
};

function validateCategoryName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return "El nombre de la categoría es obligatorio.";
  }
  if (trimmed.length > 120) {
    return "El nombre es demasiado largo.";
  }
  return null;
}

export async function createMerchantCategory(
  merchantId: string,
  input: { name: string },
  deps: CategoryDeps,
): Promise<Result<{ id: string }, CatalogApplicationError>> {
  await deps.requireCatalogAccess(merchantId);

  const nameError = validateCategoryName(input.name);
  if (nameError) {
    return err({ code: "INVALID_NAME", message: nameError });
  }

  const name = input.name.trim();

  try {
    const sortOrder = await deps.nextCategorySortOrder(merchantId);
    const category = await deps.insertMerchantCategory({
      merchantId,
      name,
      sortOrder,
      active: true,
    });
    return ok({ id: category.id });
  } catch (error) {
    if (deps.isUniqueViolation(error)) {
      return err({
        code: "DUPLICATE_CATEGORY",
        message: "Ya existe una categoría con ese nombre.",
      });
    }
    return err({
      code: "WRITE_FAILED",
      message: "No se pudo crear la categoría.",
    });
  }
}

export async function updateMerchantCategory(
  merchantId: string,
  categoryId: string,
  input: { name?: string; active?: boolean },
  deps: CategoryDeps,
): Promise<Result<{ id: string }, CatalogApplicationError>> {
  await deps.requireCatalogAccess(merchantId);

  const existing = await deps.findMerchantCategoryById(merchantId, categoryId);
  if (!existing) {
    return err({
      code: "CATEGORY_NOT_FOUND",
      message: "La categoría no existe.",
    });
  }

  const patch: { name?: string; active?: boolean } = {};
  if (input.name !== undefined) {
    const nameError = validateCategoryName(input.name);
    if (nameError) {
      return err({ code: "INVALID_NAME", message: nameError });
    }
    patch.name = input.name.trim();
  }
  if (input.active !== undefined) {
    patch.active = Boolean(input.active);
  }

  if (Object.keys(patch).length === 0) {
    return ok({ id: existing.id });
  }

  try {
    const updated = await deps.updateMerchantCategory(
      merchantId,
      categoryId,
      patch,
    );
    if (!updated) {
      return err({
        code: "CATEGORY_NOT_FOUND",
        message: "La categoría no existe.",
      });
    }
    return ok({ id: updated.id });
  } catch (error) {
    if (deps.isUniqueViolation(error)) {
      return err({
        code: "DUPLICATE_CATEGORY",
        message: "Ya existe una categoría con ese nombre.",
      });
    }
    return err({
      code: "WRITE_FAILED",
      message: "No se pudo actualizar la categoría.",
    });
  }
}

export async function reorderMerchantCategory(
  merchantId: string,
  categoryId: string,
  direction: "up" | "down",
  deps: CategoryDeps,
): Promise<Result<{ ok: true }, CatalogApplicationError>> {
  await deps.requireCatalogAccess(merchantId);

  const existing = await deps.findMerchantCategoryById(merchantId, categoryId);
  if (!existing) {
    return err({
      code: "CATEGORY_NOT_FOUND",
      message: "La categoría no existe.",
    });
  }

  const swapped = await deps.swapCategorySortOrder(
    merchantId,
    categoryId,
    direction,
  );
  if (!swapped) {
    return err({
      code: "REORDER_BLOCKED",
      message: "No se puede reordenar en esa dirección.",
    });
  }
  return ok({ ok: true });
}

export async function deleteMerchantCategory(
  merchantId: string,
  categoryId: string,
  deps: CategoryDeps,
): Promise<Result<{ ok: true }, CatalogApplicationError>> {
  await deps.requireCatalogAccess(merchantId);

  const existing = await deps.findMerchantCategoryById(merchantId, categoryId);
  if (!existing) {
    return err({
      code: "CATEGORY_NOT_FOUND",
      message: "La categoría no existe.",
    });
  }

  const productCount = await deps.countProductsInCategory(
    merchantId,
    categoryId,
  );
  if (productCount > 0) {
    return err({
      code: "CATEGORY_HAS_PRODUCTS",
      message: "No se puede eliminar una categoría con productos.",
    });
  }

  const deleted = await deps.deleteMerchantCategory(merchantId, categoryId);
  if (!deleted) {
    return err({
      code: "WRITE_FAILED",
      message: "No se pudo eliminar la categoría.",
    });
  }
  return ok({ ok: true });
}
