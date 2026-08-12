import { describe, expect, it } from "vitest";
import {
  buildProductImageObjectPath,
  isProductImagePathOwnedByMerchant,
  PRODUCT_IMAGE_MAX_BYTES,
  validateProductImageFile,
} from "./product-image";

const MERCHANT = "11111111-1111-4111-8111-111111111111";
const PRODUCT = "33333333-3333-4333-8333-333333333333";
const OBJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("validateProductImageFile", () => {
  it("accepts jpeg/png/webp within size limit", () => {
    expect(
      validateProductImageFile({
        mimeType: "image/jpeg",
        sizeBytes: 1024,
      }),
    ).toBeNull();
    expect(
      validateProductImageFile({
        mimeType: "image/png",
        sizeBytes: 2048,
      }),
    ).toBeNull();
    expect(
      validateProductImageFile({
        mimeType: "image/webp",
        sizeBytes: 4096,
      }),
    ).toBeNull();
  });

  it("rejects svg and other mime types", () => {
    expect(
      validateProductImageFile({
        mimeType: "image/svg+xml",
        sizeBytes: 100,
      })?.code,
    ).toBe("INVALID_TYPE");
    expect(
      validateProductImageFile({
        mimeType: "application/pdf",
        sizeBytes: 100,
      })?.code,
    ).toBe("INVALID_TYPE");
  });

  it("rejects oversized files", () => {
    expect(
      validateProductImageFile({
        mimeType: "image/jpeg",
        sizeBytes: PRODUCT_IMAGE_MAX_BYTES + 1,
      })?.code,
    ).toBe("TOO_LARGE");
  });

  it("rejects empty files", () => {
    expect(
      validateProductImageFile({
        mimeType: "image/jpeg",
        sizeBytes: 0,
      })?.code,
    ).toBe("EMPTY");
  });
});

describe("buildProductImageObjectPath", () => {
  it("builds merchant-scoped stable path", () => {
    expect(
      buildProductImageObjectPath({
        merchantId: MERCHANT,
        productId: PRODUCT,
        objectId: OBJECT,
        mimeType: "image/webp",
      }),
    ).toBe(`${MERCHANT}/products/${PRODUCT}/${OBJECT}.webp`);
  });

  it("checks merchant ownership of path", () => {
    const path = `${MERCHANT}/products/${PRODUCT}/${OBJECT}.jpg`;
    expect(isProductImagePathOwnedByMerchant(path, MERCHANT)).toBe(true);
    expect(
      isProductImagePathOwnedByMerchant(
        path,
        "22222222-2222-4222-8222-222222222222",
      ),
    ).toBe(false);
    expect(isProductImagePathOwnedByMerchant("../etc/passwd", MERCHANT)).toBe(
      false,
    );
  });
});
