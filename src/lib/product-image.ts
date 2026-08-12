import { isValidUuid } from "@/lib/uuid";

export const PRODUCT_IMAGES_BUCKET = "product-images";

export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const PRODUCT_IMAGE_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ProductImageMimeType =
  (typeof PRODUCT_IMAGE_ALLOWED_MIME_TYPES)[number];

export const PRODUCT_IMAGE_ACCEPT_ATTR = "image/jpeg,image/png,image/webp";

export const PRODUCT_IMAGE_HELP_TEXT = "JPG, PNG o WEBP. Máximo 5 MB.";

const MIME_TO_EXT: Record<ProductImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type ProductImageValidationError = {
  code: "INVALID_TYPE" | "TOO_LARGE" | "EMPTY";
  message: string;
};

export function isAllowedProductImageMime(
  mime: string,
): mime is ProductImageMimeType {
  return (PRODUCT_IMAGE_ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

export function validateProductImageFile(input: {
  mimeType: string;
  sizeBytes: number;
}): ProductImageValidationError | null {
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return {
      code: "EMPTY",
      message: "Seleccioná un archivo de imagen.",
    };
  }

  if (!isAllowedProductImageMime(input.mimeType)) {
    return {
      code: "INVALID_TYPE",
      message: "Solo se permiten imágenes JPG, PNG o WEBP.",
    };
  }

  if (input.sizeBytes > PRODUCT_IMAGE_MAX_BYTES) {
    return {
      code: "TOO_LARGE",
      message: "La imagen supera el máximo de 5 MB.",
    };
  }

  return null;
}

export function extensionForProductImageMime(
  mime: ProductImageMimeType,
): string {
  return MIME_TO_EXT[mime];
}

/**
 * Stable, merchant-scoped object path. Never trust a client-supplied path.
 */
export function buildProductImageObjectPath(input: {
  merchantId: string;
  productId: string;
  objectId: string;
  mimeType: ProductImageMimeType;
}): string {
  if (!isValidUuid(input.merchantId) || !isValidUuid(input.productId)) {
    throw new Error("Invalid merchant or product id for image path");
  }
  if (!isValidUuid(input.objectId)) {
    throw new Error("Invalid object id for image path");
  }

  const ext = extensionForProductImageMime(input.mimeType);
  return `${input.merchantId}/products/${input.productId}/${input.objectId}.${ext}`;
}

export function isProductImagePathOwnedByMerchant(
  imagePath: string,
  merchantId: string,
): boolean {
  if (!isValidUuid(merchantId)) {
    return false;
  }
  const prefix = `${merchantId}/products/`;
  return imagePath.startsWith(prefix) && !imagePath.includes("..");
}
