import "server-only";

import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin";
import {
  buildProductImageObjectPath,
  isAllowedProductImageMime,
  PRODUCT_IMAGES_BUCKET,
  type ProductImageMimeType,
} from "@/lib/product-image";

export const PRODUCT_IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 60;

export type ProductImageUploadResult = {
  path: string;
};

/**
 * Storage writes use the service-role client AFTER application authorization.
 * Never call from Client Components. Never expose SUPABASE_SECRET_KEY.
 */
export async function uploadProductImageObject(input: {
  merchantId: string;
  productId: string;
  mimeType: string;
  bytes: ArrayBuffer | Uint8Array | Buffer;
}): Promise<ProductImageUploadResult> {
  if (!isAllowedProductImageMime(input.mimeType)) {
    throw new Error("Unsupported product image MIME type");
  }

  const objectId = randomUUID();
  const path = buildProductImageObjectPath({
    merchantId: input.merchantId,
    productId: input.productId,
    objectId,
    mimeType: input.mimeType as ProductImageMimeType,
  });

  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, input.bytes, {
      contentType: input.mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error("PRODUCT_IMAGE_UPLOAD_FAILED");
  }

  return { path };
}

export async function deleteProductImageObject(
  imagePath: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .remove([imagePath]);

  if (error) {
    throw new Error("PRODUCT_IMAGE_DELETE_FAILED");
  }
}

export async function createProductImageSignedUrl(
  imagePath: string,
  expiresInSeconds = PRODUCT_IMAGE_SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .createSignedUrl(imagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function createProductImageSignedUrls(
  imagePaths: readonly string[],
  expiresInSeconds = PRODUCT_IMAGE_SIGNED_URL_TTL_SECONDS,
): Promise<Map<string, string>> {
  const unique = [...new Set(imagePaths.filter(Boolean))];
  const result = new Map<string, string>();
  if (unique.length === 0) {
    return result;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .createSignedUrls(unique, expiresInSeconds);

  if (error || !data) {
    return result;
  }

  for (const row of data) {
    if (row.path && row.signedUrl && !row.error) {
      result.set(row.path, row.signedUrl);
    }
  }

  return result;
}
