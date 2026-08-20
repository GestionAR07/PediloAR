import "server-only";

import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin";
import {
  buildMerchantCoverObjectPath,
  isAllowedMerchantCoverMime,
  MERCHANT_IMAGES_BUCKET,
  type MerchantCoverMimeType,
} from "@/lib/merchant-cover-image";

export const MERCHANT_COVER_SIGNED_URL_TTL_SECONDS = 60 * 60;

export type MerchantCoverUploadResult = {
  path: string;
};

/**
 * Storage writes use the service-role client AFTER application authorization.
 * Never call from Client Components. Never expose SUPABASE_SECRET_KEY.
 */
export async function uploadMerchantCoverObject(input: {
  merchantId: string;
  mimeType: string;
  bytes: ArrayBuffer | Uint8Array | Buffer;
}): Promise<MerchantCoverUploadResult> {
  if (!isAllowedMerchantCoverMime(input.mimeType)) {
    throw new Error("Unsupported merchant cover MIME type");
  }

  const objectId = randomUUID();
  const path = buildMerchantCoverObjectPath({
    merchantId: input.merchantId,
    objectId,
    mimeType: input.mimeType as MerchantCoverMimeType,
  });

  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage
    .from(MERCHANT_IMAGES_BUCKET)
    .upload(path, input.bytes, {
      contentType: input.mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error("MERCHANT_COVER_UPLOAD_FAILED");
  }

  return { path };
}

export async function deleteMerchantCoverObject(
  imagePath: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage
    .from(MERCHANT_IMAGES_BUCKET)
    .remove([imagePath]);

  if (error) {
    throw new Error("MERCHANT_COVER_DELETE_FAILED");
  }
}

export async function createMerchantCoverSignedUrl(
  imagePath: string,
  expiresInSeconds = MERCHANT_COVER_SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(MERCHANT_IMAGES_BUCKET)
    .createSignedUrl(imagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function createMerchantCoverSignedUrls(
  imagePaths: readonly string[],
  expiresInSeconds = MERCHANT_COVER_SIGNED_URL_TTL_SECONDS,
): Promise<Map<string, string>> {
  const unique = [...new Set(imagePaths.filter(Boolean))];
  const result = new Map<string, string>();
  if (unique.length === 0) {
    return result;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(MERCHANT_IMAGES_BUCKET)
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
