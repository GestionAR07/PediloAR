import "server-only";

import {
  deleteMerchantCover as deleteMerchantCoverUseCase,
  MERCHANT_COVER_ALLOWED_ROLES,
  upsertMerchantCover as upsertMerchantCoverUseCase,
} from "@/application/merchant/cover-image";
import {
  findMerchantCoverPath,
  setMerchantCoverImagePath,
} from "@/infrastructure/db/repositories/merchant-repository";
import {
  createMerchantCoverSignedUrl,
  deleteMerchantCoverObject,
  uploadMerchantCoverObject,
} from "@/infrastructure/storage/merchant-images";
import { requireMerchantRole } from "@/server/auth/authorization";

async function requireCoverAccess(merchantId: string): Promise<void> {
  await requireMerchantRole(merchantId, MERCHANT_COVER_ALLOWED_ROLES);
}

function coverDeps() {
  return {
    requireCoverAccess,
    findMerchantCover: findMerchantCoverPath,
    setMerchantCoverPath: setMerchantCoverImagePath,
    uploadObject: uploadMerchantCoverObject,
    deleteObject: deleteMerchantCoverObject,
  };
}

export async function upsertMerchantCoverApp(
  merchantId: string,
  file: Parameters<typeof upsertMerchantCoverUseCase>[1],
) {
  return upsertMerchantCoverUseCase(merchantId, file, coverDeps());
}

export async function deleteMerchantCoverApp(merchantId: string) {
  return deleteMerchantCoverUseCase(merchantId, coverDeps());
}

export async function getMerchantCoverPreviewApp(
  merchantId: string,
): Promise<{ coverUrl: string | null }> {
  await requireCoverAccess(merchantId);
  const row = await findMerchantCoverPath(merchantId);
  if (!row?.coverImagePath) {
    return { coverUrl: null };
  }

  try {
    const coverUrl = await createMerchantCoverSignedUrl(row.coverImagePath);
    return { coverUrl };
  } catch {
    return { coverUrl: null };
  }
}
