import { validateProductImageFile } from "@/lib/product-image";

export type ProductImageClientGateResult =
  { proceed: true } | { proceed: false; error: string };

/**
 * Browser-side gate before invoking the upload Server Action.
 * UX only — server validation remains authoritative.
 */
export function gateProductImageBeforeUpload(file: {
  type: string;
  size: number;
}): ProductImageClientGateResult {
  const validation = validateProductImageFile({
    mimeType: file.type,
    sizeBytes: file.size,
  });
  if (validation) {
    return { proceed: false, error: validation.message };
  }
  return { proceed: true };
}
