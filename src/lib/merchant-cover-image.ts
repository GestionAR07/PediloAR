import {
  extensionForProductImageMime,
  isAllowedProductImageMime,
  PRODUCT_IMAGE_ACCEPT_ATTR,
  PRODUCT_IMAGE_ALLOWED_MIME_TYPES,
  PRODUCT_IMAGE_HELP_TEXT,
  PRODUCT_IMAGE_MAX_BYTES,
  type ProductImageMimeType,
  validateProductImageFile,
} from "@/lib/product-image";
import { isValidUuid } from "@/lib/uuid";

export const MERCHANT_IMAGES_BUCKET = "merchant-images";

export const MERCHANT_COVER_MAX_BYTES = PRODUCT_IMAGE_MAX_BYTES;
export const MERCHANT_COVER_ALLOWED_MIME_TYPES =
  PRODUCT_IMAGE_ALLOWED_MIME_TYPES;
export const MERCHANT_COVER_ACCEPT_ATTR = PRODUCT_IMAGE_ACCEPT_ATTR;
export const MERCHANT_COVER_HELP_TEXT = PRODUCT_IMAGE_HELP_TEXT;

export const validateMerchantCoverFile = validateProductImageFile;
export const isAllowedMerchantCoverMime = isAllowedProductImageMime;
export type MerchantCoverMimeType = ProductImageMimeType;

/**
 * Stable, merchant-scoped cover path. Never trust a client-supplied path.
 */
export function buildMerchantCoverObjectPath(input: {
  merchantId: string;
  objectId: string;
  mimeType: MerchantCoverMimeType;
}): string {
  if (!isValidUuid(input.merchantId)) {
    throw new Error("Invalid merchant id for cover path");
  }
  if (!isValidUuid(input.objectId)) {
    throw new Error("Invalid object id for cover path");
  }

  const ext = extensionForProductImageMime(input.mimeType);
  return `${input.merchantId}/cover/${input.objectId}.${ext}`;
}

export function isMerchantCoverPathOwnedByMerchant(
  imagePath: string,
  merchantId: string,
): boolean {
  if (!isValidUuid(merchantId)) {
    return false;
  }
  const prefix = `${merchantId}/cover/`;
  return imagePath.startsWith(prefix) && !imagePath.includes("..");
}
