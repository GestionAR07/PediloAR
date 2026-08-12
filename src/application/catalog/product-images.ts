import { err, ok, type Result } from "@/domain/shared/result";
import {
  isProductImagePathOwnedByMerchant,
  validateProductImageFile,
} from "@/lib/product-image";
import { isValidUuid } from "@/lib/uuid";
import type { CatalogApplicationError, CatalogAuthDeps } from "./types";

export type ProductImageDeps = CatalogAuthDeps & {
  findProductById: (
    merchantId: string,
    productId: string,
  ) => Promise<{
    id: string;
    imagePath: string | null;
  } | null>;
  setProductImagePath: (
    merchantId: string,
    productId: string,
    imagePath: string | null,
  ) => Promise<{ id: string; imagePath: string | null } | null>;
  uploadObject: (input: {
    merchantId: string;
    productId: string;
    mimeType: string;
    bytes: ArrayBuffer | Uint8Array | Buffer;
  }) => Promise<{ path: string }>;
  deleteObject: (imagePath: string) => Promise<void>;
};

export type ProductImageFileInput = {
  mimeType: string;
  sizeBytes: number;
  bytes: ArrayBuffer | Uint8Array | Buffer;
};

async function loadScopedProduct(
  merchantId: string,
  productId: string,
  deps: ProductImageDeps,
): Promise<
  Result<{ id: string; imagePath: string | null }, CatalogApplicationError>
> {
  if (!isValidUuid(productId)) {
    return err({
      code: "PRODUCT_NOT_FOUND",
      message: "El producto no existe.",
    });
  }

  const product = await deps.findProductById(merchantId, productId);
  if (!product) {
    return err({
      code: "PRODUCT_NOT_FOUND",
      message: "El producto no existe.",
    });
  }

  return ok(product);
}

/**
 * Upload or replace product image.
 * Order: authorize → validate → upload new → update path → best-effort delete old.
 * If cleanup of the previous object fails, the product still points to the new image.
 */
export async function upsertProductImage(
  merchantId: string,
  productId: string,
  file: ProductImageFileInput,
  deps: ProductImageDeps,
): Promise<Result<{ imagePath: string }, CatalogApplicationError>> {
  await deps.requireCatalogAccess(merchantId);

  const productResult = await loadScopedProduct(merchantId, productId, deps);
  if (!productResult.ok) {
    return productResult;
  }

  const validation = validateProductImageFile({
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
  });
  if (validation) {
    return err({ code: validation.code, message: validation.message });
  }

  let uploaded: { path: string };
  try {
    uploaded = await deps.uploadObject({
      merchantId,
      productId,
      mimeType: file.mimeType,
      bytes: file.bytes,
    });
  } catch {
    return err({
      code: "UPLOAD_FAILED",
      message: "No se pudo subir la imagen. Intentá de nuevo.",
    });
  }

  const updated = await deps.setProductImagePath(
    merchantId,
    productId,
    uploaded.path,
  );
  if (!updated) {
    try {
      await deps.deleteObject(uploaded.path);
    } catch {
      // Orphan object possible; product path unchanged.
    }
    return err({
      code: "PRODUCT_NOT_FOUND",
      message: "El producto no existe.",
    });
  }

  const previousPath = productResult.value.imagePath;
  if (
    previousPath &&
    previousPath !== uploaded.path &&
    isProductImagePathOwnedByMerchant(previousPath, merchantId)
  ) {
    try {
      await deps.deleteObject(previousPath);
    } catch {
      // Residual orphan: product already points to the new image.
    }
  }

  return ok({ imagePath: uploaded.path });
}

export async function deleteProductImage(
  merchantId: string,
  productId: string,
  deps: ProductImageDeps,
): Promise<Result<{ imagePath: null }, CatalogApplicationError>> {
  await deps.requireCatalogAccess(merchantId);

  const productResult = await loadScopedProduct(merchantId, productId, deps);
  if (!productResult.ok) {
    return productResult;
  }

  const currentPath = productResult.value.imagePath;
  if (!currentPath) {
    return ok({ imagePath: null });
  }

  if (!isProductImagePathOwnedByMerchant(currentPath, merchantId)) {
    return err({
      code: "INVALID_IMAGE_PATH",
      message: "La imagen del producto no es válida.",
    });
  }

  const updated = await deps.setProductImagePath(merchantId, productId, null);
  if (!updated) {
    return err({
      code: "PRODUCT_NOT_FOUND",
      message: "El producto no existe.",
    });
  }

  try {
    await deps.deleteObject(currentPath);
  } catch {
    // Path cleared; storage object may remain as orphan until cleanup.
  }

  return ok({ imagePath: null });
}
