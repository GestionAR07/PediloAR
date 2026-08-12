import { describe, expect, it, vi } from "vitest";
import { PRODUCT_IMAGE_MAX_BYTES } from "@/lib/product-image";
import { AuthzError } from "@/server/auth/errors";
import {
  deleteProductImage,
  upsertProductImage,
  type ProductImageDeps,
} from "./product-images";

const MERCHANT_A = "11111111-1111-4111-8111-111111111111";
const MERCHANT_B = "22222222-2222-4222-8222-222222222222";
const PROD_A = "33333333-3333-4333-8333-333333333333";
const PROD_B = "88888888-8888-4888-8888-888888888888";
const PATH_A = `${MERCHANT_A}/products/${PROD_A}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg`;
const PATH_NEW = `${MERCHANT_A}/products/${PROD_A}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp`;

function baseDeps(overrides: Partial<ProductImageDeps> = {}): ProductImageDeps {
  return {
    requireCatalogAccess: vi.fn(async () => undefined),
    findProductById: vi.fn(async () => ({
      id: PROD_A,
      imagePath: null,
    })),
    setProductImagePath: vi.fn(async (_m, _p, imagePath) => ({
      id: PROD_A,
      imagePath,
    })),
    uploadObject: vi.fn(async () => ({ path: PATH_NEW })),
    deleteObject: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("upsertProductImage", () => {
  it("uploads image for scoped product", async () => {
    const deps = baseDeps();
    const result = await upsertProductImage(
      MERCHANT_A,
      PROD_A,
      {
        mimeType: "image/webp",
        sizeBytes: 1200,
        bytes: Buffer.from("fake"),
      },
      deps,
    );
    expect(result.ok).toBe(true);
    expect(deps.uploadObject).toHaveBeenCalled();
    expect(deps.setProductImagePath).toHaveBeenCalledWith(
      MERCHANT_A,
      PROD_A,
      PATH_NEW,
    );
  });

  it("rejects invalid mime before upload", async () => {
    const deps = baseDeps();
    const result = await upsertProductImage(
      MERCHANT_A,
      PROD_A,
      {
        mimeType: "image/svg+xml",
        sizeBytes: 100,
        bytes: Buffer.from("x"),
      },
      deps,
    );
    expect(result.ok).toBe(false);
    expect(deps.uploadObject).not.toHaveBeenCalled();
  });

  it("rejects >5 MB on the server even if the client skipped checks", async () => {
    const deps = baseDeps();
    const result = await upsertProductImage(
      MERCHANT_A,
      PROD_A,
      {
        mimeType: "image/jpeg",
        sizeBytes: PRODUCT_IMAGE_MAX_BYTES + 1,
        bytes: Buffer.from("pretend-large"),
      },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("La imagen no puede superar los 5 MB.");
    }
    expect(deps.uploadObject).not.toHaveBeenCalled();
  });

  it("replaces previous image and deletes old object after path update", async () => {
    const deps = baseDeps({
      findProductById: vi.fn(async () => ({
        id: PROD_A,
        imagePath: PATH_A,
      })),
    });
    const result = await upsertProductImage(
      MERCHANT_A,
      PROD_A,
      {
        mimeType: "image/webp",
        sizeBytes: 1200,
        bytes: Buffer.from("fake"),
      },
      deps,
    );
    expect(result.ok).toBe(true);
    expect(deps.setProductImagePath).toHaveBeenCalledWith(
      MERCHANT_A,
      PROD_A,
      PATH_NEW,
    );
    expect(deps.deleteObject).toHaveBeenCalledWith(PATH_A);
  });

  it("keeps new image path if old object cleanup fails", async () => {
    const deps = baseDeps({
      findProductById: vi.fn(async () => ({
        id: PROD_A,
        imagePath: PATH_A,
      })),
      deleteObject: vi.fn(async () => {
        throw new Error("storage down");
      }),
    });
    const result = await upsertProductImage(
      MERCHANT_A,
      PROD_A,
      {
        mimeType: "image/webp",
        sizeBytes: 1200,
        bytes: Buffer.from("fake"),
      },
      deps,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.imagePath).toBe(PATH_NEW);
    }
  });

  it("denies product outside merchant scope", async () => {
    const deps = baseDeps({
      findProductById: vi.fn(async () => null),
    });
    const result = await upsertProductImage(
      MERCHANT_A,
      PROD_B,
      {
        mimeType: "image/jpeg",
        sizeBytes: 100,
        bytes: Buffer.from("x"),
      },
      deps,
    );
    expect(result.ok).toBe(false);
    expect(deps.uploadObject).not.toHaveBeenCalled();
  });

  it("requires membership", async () => {
    const deps = baseDeps({
      requireCatalogAccess: vi.fn(async () => {
        throw new AuthzError("NOT_MERCHANT_MEMBER", "no");
      }),
    });
    await expect(
      upsertProductImage(
        MERCHANT_B,
        PROD_A,
        {
          mimeType: "image/jpeg",
          sizeBytes: 100,
          bytes: Buffer.from("x"),
        },
        deps,
      ),
    ).rejects.toBeInstanceOf(AuthzError);
  });
});

describe("deleteProductImage", () => {
  it("clears path and deletes object", async () => {
    const deps = baseDeps({
      findProductById: vi.fn(async () => ({
        id: PROD_A,
        imagePath: PATH_A,
      })),
    });
    const result = await deleteProductImage(MERCHANT_A, PROD_A, deps);
    expect(result.ok).toBe(true);
    expect(deps.setProductImagePath).toHaveBeenCalledWith(
      MERCHANT_A,
      PROD_A,
      null,
    );
    expect(deps.deleteObject).toHaveBeenCalledWith(PATH_A);
  });

  it("is idempotent when imagePath is already null", async () => {
    const deps = baseDeps();
    const result = await deleteProductImage(MERCHANT_A, PROD_A, deps);
    expect(result.ok).toBe(true);
    expect(deps.deleteObject).not.toHaveBeenCalled();
  });

  it("denies delete for product outside merchant scope", async () => {
    const deps = baseDeps({
      findProductById: vi.fn(async () => null),
    });
    const result = await deleteProductImage(MERCHANT_A, PROD_B, deps);
    expect(result.ok).toBe(false);
  });
});
