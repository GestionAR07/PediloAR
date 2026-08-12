import "server-only";

import {
  createMerchantCategory as createMerchantCategoryUseCase,
  deleteMerchantCategory as deleteMerchantCategoryUseCase,
  reorderMerchantCategory as reorderMerchantCategoryUseCase,
  updateMerchantCategory as updateMerchantCategoryUseCase,
} from "@/application/catalog/categories";
import {
  createOptionChoice as createOptionChoiceUseCase,
  createOptionGroup as createOptionGroupUseCase,
  updateOptionChoice as updateOptionChoiceUseCase,
  updateOptionGroup as updateOptionGroupUseCase,
} from "@/application/catalog/options";
import {
  createProduct as createProductUseCase,
  toggleProductAvailability as toggleProductAvailabilityUseCase,
  updateProduct as updateProductUseCase,
} from "@/application/catalog/products";
import { CATALOG_ALLOWED_ROLES } from "@/application/catalog/types";
import {
  countProductsInCategory,
  deleteMerchantCategory,
  findMerchantCategoryById,
  findOptionChoiceById,
  findOptionGroupById,
  findProductById,
  insertMerchantCategory,
  insertOptionChoice,
  insertOptionGroup,
  insertProduct,
  nextCategorySortOrder,
  nextOptionChoiceSortOrder,
  nextOptionGroupSortOrder,
  nextProductSortOrder,
  setProductAvailability,
  setProductImagePath,
  swapCategorySortOrder,
  updateMerchantCategory,
  updateOptionChoice,
  updateOptionGroup,
  updateProduct,
} from "@/infrastructure/db/repositories/catalog-repository";
import {
  deleteProductImageObject,
  uploadProductImageObject,
} from "@/infrastructure/storage/product-images";
import { isUniqueViolation } from "@/infrastructure/db/pg-errors";
import { requireMerchantRole } from "@/server/auth/authorization";
import {
  deleteProductImage as deleteProductImageUseCase,
  upsertProductImage as upsertProductImageUseCase,
} from "@/application/catalog/product-images";

async function requireCatalogAccess(merchantId: string): Promise<void> {
  await requireMerchantRole(merchantId, CATALOG_ALLOWED_ROLES);
}

function categoryDeps() {
  return {
    requireCatalogAccess,
    findMerchantCategoryById,
    countProductsInCategory,
    nextCategorySortOrder,
    insertMerchantCategory,
    updateMerchantCategory,
    deleteMerchantCategory,
    swapCategorySortOrder,
    isUniqueViolation,
  };
}

function productDeps() {
  return {
    requireCatalogAccess,
    findMerchantCategoryById,
    findProductById,
    nextProductSortOrder,
    insertProduct,
    updateProduct,
    setProductAvailability,
  };
}

function optionDeps() {
  return {
    requireCatalogAccess,
    findProductById,
    findOptionGroupById,
    findOptionChoiceById,
    nextOptionGroupSortOrder,
    nextOptionChoiceSortOrder,
    insertOptionGroup,
    updateOptionGroup,
    insertOptionChoice,
    updateOptionChoice,
  };
}

function productImageDeps() {
  return {
    requireCatalogAccess,
    findProductById,
    setProductImagePath,
    uploadObject: uploadProductImageObject,
    deleteObject: deleteProductImageObject,
  };
}

export async function createMerchantCategoryApp(
  merchantId: string,
  input: { name: string },
) {
  return createMerchantCategoryUseCase(merchantId, input, categoryDeps());
}

export async function updateMerchantCategoryApp(
  merchantId: string,
  categoryId: string,
  input: { name?: string; active?: boolean },
) {
  return updateMerchantCategoryUseCase(
    merchantId,
    categoryId,
    input,
    categoryDeps(),
  );
}

export async function reorderMerchantCategoryApp(
  merchantId: string,
  categoryId: string,
  direction: "up" | "down",
) {
  return reorderMerchantCategoryUseCase(
    merchantId,
    categoryId,
    direction,
    categoryDeps(),
  );
}

export async function deleteMerchantCategoryApp(
  merchantId: string,
  categoryId: string,
) {
  return deleteMerchantCategoryUseCase(merchantId, categoryId, categoryDeps());
}

export async function createProductApp(
  merchantId: string,
  input: Parameters<typeof createProductUseCase>[1],
) {
  return createProductUseCase(merchantId, input, productDeps());
}

export async function updateProductApp(
  merchantId: string,
  productId: string,
  input: Parameters<typeof updateProductUseCase>[2],
) {
  return updateProductUseCase(merchantId, productId, input, productDeps());
}

export async function toggleProductAvailabilityApp(
  merchantId: string,
  productId: string,
) {
  return toggleProductAvailabilityUseCase(merchantId, productId, productDeps());
}

export async function createOptionGroupApp(
  merchantId: string,
  input: Parameters<typeof createOptionGroupUseCase>[1],
) {
  return createOptionGroupUseCase(merchantId, input, optionDeps());
}

export async function updateOptionGroupApp(
  merchantId: string,
  groupId: string,
  input: Parameters<typeof updateOptionGroupUseCase>[2],
) {
  return updateOptionGroupUseCase(merchantId, groupId, input, optionDeps());
}

export async function createOptionChoiceApp(
  merchantId: string,
  input: Parameters<typeof createOptionChoiceUseCase>[1],
) {
  return createOptionChoiceUseCase(merchantId, input, optionDeps());
}

export async function updateOptionChoiceApp(
  merchantId: string,
  choiceId: string,
  input: Parameters<typeof updateOptionChoiceUseCase>[2],
) {
  return updateOptionChoiceUseCase(merchantId, choiceId, input, optionDeps());
}

export async function upsertProductImageApp(
  merchantId: string,
  productId: string,
  file: Parameters<typeof upsertProductImageUseCase>[2],
) {
  return upsertProductImageUseCase(
    merchantId,
    productId,
    file,
    productImageDeps(),
  );
}

export async function deleteProductImageApp(
  merchantId: string,
  productId: string,
) {
  return deleteProductImageUseCase(merchantId, productId, productImageDeps());
}
