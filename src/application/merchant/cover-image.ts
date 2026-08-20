import { err, ok, type Result } from "@/domain/shared/result";
import {
  isMerchantCoverPathOwnedByMerchant,
  validateMerchantCoverFile,
} from "@/lib/merchant-cover-image";
import { isValidUuid } from "@/lib/uuid";

export type MerchantCoverApplicationError = {
  code: string;
  message: string;
};

export const MERCHANT_COVER_ALLOWED_ROLES = ["OWNER", "STAFF"] as const;

export type MerchantCoverDeps = {
  requireCoverAccess: (merchantId: string) => Promise<void>;
  findMerchantCover: (
    merchantId: string,
  ) => Promise<{ id: string; coverImagePath: string | null } | null>;
  setMerchantCoverPath: (
    merchantId: string,
    coverImagePath: string | null,
  ) => Promise<{ id: string; coverImagePath: string | null } | null>;
  uploadObject: (input: {
    merchantId: string;
    mimeType: string;
    bytes: ArrayBuffer | Uint8Array | Buffer;
  }) => Promise<{ path: string }>;
  deleteObject: (imagePath: string) => Promise<void>;
};

export type MerchantCoverFileInput = {
  mimeType: string;
  sizeBytes: number;
  bytes: ArrayBuffer | Uint8Array | Buffer;
};

async function loadScopedMerchant(
  merchantId: string,
  deps: MerchantCoverDeps,
): Promise<
  Result<
    { id: string; coverImagePath: string | null },
    MerchantCoverApplicationError
  >
> {
  if (!isValidUuid(merchantId)) {
    return err({
      code: "MERCHANT_NOT_FOUND",
      message: "El comercio no existe.",
    });
  }

  const merchant = await deps.findMerchantCover(merchantId);
  if (!merchant) {
    return err({
      code: "MERCHANT_NOT_FOUND",
      message: "El comercio no existe.",
    });
  }

  return ok(merchant);
}

/**
 * Upload or replace merchant cover.
 * Order: authorize → validate → upload new → update path → best-effort delete old.
 * If cleanup of the previous object fails, the merchant still points to the new image.
 */
export async function upsertMerchantCover(
  merchantId: string,
  file: MerchantCoverFileInput,
  deps: MerchantCoverDeps,
): Promise<Result<{ coverImagePath: string }, MerchantCoverApplicationError>> {
  await deps.requireCoverAccess(merchantId);

  const merchantResult = await loadScopedMerchant(merchantId, deps);
  if (!merchantResult.ok) {
    return merchantResult;
  }

  const validation = validateMerchantCoverFile({
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
      mimeType: file.mimeType,
      bytes: file.bytes,
    });
  } catch {
    return err({
      code: "UPLOAD_FAILED",
      message: "No se pudo subir la imagen. Intentá de nuevo.",
    });
  }

  const updated = await deps.setMerchantCoverPath(merchantId, uploaded.path);
  if (!updated) {
    try {
      await deps.deleteObject(uploaded.path);
    } catch {
      // Orphan object possible; merchant path unchanged.
    }
    return err({
      code: "MERCHANT_NOT_FOUND",
      message: "El comercio no existe.",
    });
  }

  const previousPath = merchantResult.value.coverImagePath;
  if (
    previousPath &&
    previousPath !== uploaded.path &&
    isMerchantCoverPathOwnedByMerchant(previousPath, merchantId)
  ) {
    try {
      await deps.deleteObject(previousPath);
    } catch {
      // Residual orphan: merchant already points to the new image.
    }
  }

  return ok({ coverImagePath: uploaded.path });
}

export async function deleteMerchantCover(
  merchantId: string,
  deps: MerchantCoverDeps,
): Promise<Result<{ coverImagePath: null }, MerchantCoverApplicationError>> {
  await deps.requireCoverAccess(merchantId);

  const merchantResult = await loadScopedMerchant(merchantId, deps);
  if (!merchantResult.ok) {
    return merchantResult;
  }

  const currentPath = merchantResult.value.coverImagePath;
  if (!currentPath) {
    return ok({ coverImagePath: null });
  }

  if (!isMerchantCoverPathOwnedByMerchant(currentPath, merchantId)) {
    return err({
      code: "INVALID_IMAGE_PATH",
      message: "La portada del comercio no es válida.",
    });
  }

  const updated = await deps.setMerchantCoverPath(merchantId, null);
  if (!updated) {
    return err({
      code: "MERCHANT_NOT_FOUND",
      message: "El comercio no existe.",
    });
  }

  try {
    await deps.deleteObject(currentPath);
  } catch {
    // Path cleared; storage object may remain as orphan until cleanup.
  }

  return ok({ coverImagePath: null });
}
