import { describe, expect, it } from "vitest";
import {
  buildMerchantCoverObjectPath,
  isMerchantCoverPathOwnedByMerchant,
  MERCHANT_COVER_MAX_BYTES,
  MERCHANT_IMAGES_BUCKET,
  validateMerchantCoverFile,
} from "./merchant-cover-image";
import { PRODUCT_IMAGE_MAX_BYTES } from "./product-image";

const MERCHANT = "11111111-1111-4111-8111-111111111111";
const OBJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("validateMerchantCoverFile", () => {
  it("accepts jpeg, png, and webp within the product-image size limit", () => {
    expect(
      validateMerchantCoverFile({ mimeType: "image/jpeg", sizeBytes: 1024 }),
    ).toBeNull();
    expect(
      validateMerchantCoverFile({ mimeType: "image/png", sizeBytes: 2048 }),
    ).toBeNull();
    expect(
      validateMerchantCoverFile({ mimeType: "image/webp", sizeBytes: 4096 }),
    ).toBeNull();
  });

  it("rejects svg and other mime types", () => {
    expect(
      validateMerchantCoverFile({
        mimeType: "image/svg+xml",
        sizeBytes: 100,
      })?.code,
    ).toBe("INVALID_TYPE");
    expect(
      validateMerchantCoverFile({
        mimeType: "application/pdf",
        sizeBytes: 100,
      })?.code,
    ).toBe("INVALID_TYPE");
  });

  it("shares the 5 MB product-image ceiling", () => {
    expect(MERCHANT_COVER_MAX_BYTES).toBe(PRODUCT_IMAGE_MAX_BYTES);
    expect(
      validateMerchantCoverFile({
        mimeType: "image/jpeg",
        sizeBytes: MERCHANT_COVER_MAX_BYTES,
      }),
    ).toBeNull();
    expect(
      validateMerchantCoverFile({
        mimeType: "image/jpeg",
        sizeBytes: MERCHANT_COVER_MAX_BYTES + 1,
      })?.code,
    ).toBe("TOO_LARGE");
  });
});

describe("buildMerchantCoverObjectPath", () => {
  it("builds a merchant-scoped cover path", () => {
    expect(
      buildMerchantCoverObjectPath({
        merchantId: MERCHANT,
        objectId: OBJECT,
        mimeType: "image/webp",
      }),
    ).toBe(`${MERCHANT}/cover/${OBJECT}.webp`);
    expect(MERCHANT_IMAGES_BUCKET).toBe("merchant-images");
  });

  it("checks merchant ownership and rejects traversal", () => {
    const path = `${MERCHANT}/cover/${OBJECT}.jpg`;
    expect(isMerchantCoverPathOwnedByMerchant(path, MERCHANT)).toBe(true);
    expect(
      isMerchantCoverPathOwnedByMerchant(
        path,
        "22222222-2222-4222-8222-222222222222",
      ),
    ).toBe(false);
    expect(isMerchantCoverPathOwnedByMerchant("../etc/passwd", MERCHANT)).toBe(
      false,
    );
    expect(
      isMerchantCoverPathOwnedByMerchant(
        `${MERCHANT}/products/${OBJECT}.jpg`,
        MERCHANT,
      ),
    ).toBe(false);
  });
});
