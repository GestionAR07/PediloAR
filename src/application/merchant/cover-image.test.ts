import { describe, expect, it, vi } from "vitest";
import { MERCHANT_COVER_MAX_BYTES } from "@/lib/merchant-cover-image";
import { AuthzError } from "@/server/auth/errors";
import {
  deleteMerchantCover,
  upsertMerchantCover,
  type MerchantCoverDeps,
} from "./cover-image";

const MERCHANT_A = "11111111-1111-4111-8111-111111111111";
const MERCHANT_B = "22222222-2222-4222-8222-222222222222";
const PATH_A = `${MERCHANT_A}/cover/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg`;
const PATH_NEW = `${MERCHANT_A}/cover/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp`;

function baseDeps(
  overrides: Partial<MerchantCoverDeps> = {},
): MerchantCoverDeps {
  return {
    requireCoverAccess: vi.fn(async () => undefined),
    findMerchantCover: vi.fn(async () => ({
      id: MERCHANT_A,
      coverImagePath: null,
    })),
    setMerchantCoverPath: vi.fn(async (_m, coverImagePath) => ({
      id: MERCHANT_A,
      coverImagePath,
    })),
    uploadObject: vi.fn(async () => ({ path: PATH_NEW })),
    deleteObject: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("upsertMerchantCover", () => {
  it.each([["image/jpeg"], ["image/png"], ["image/webp"]] as const)(
    "uploads a valid %s cover and persists the path",
    async (mime) => {
      const deps = baseDeps();
      const result = await upsertMerchantCover(
        MERCHANT_A,
        { mimeType: mime, sizeBytes: 1200, bytes: Buffer.from("fake") },
        deps,
      );
      expect(result.ok).toBe(true);
      expect(deps.uploadObject).toHaveBeenCalled();
      expect(deps.setMerchantCoverPath).toHaveBeenCalledWith(
        MERCHANT_A,
        PATH_NEW,
      );
    },
  );

  it("rejects svg before upload", async () => {
    const deps = baseDeps();
    const result = await upsertMerchantCover(
      MERCHANT_A,
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

  it("rejects invalid mime types", async () => {
    const deps = baseDeps();
    const result = await upsertMerchantCover(
      MERCHANT_A,
      {
        mimeType: "application/pdf",
        sizeBytes: 100,
        bytes: Buffer.from("x"),
      },
      deps,
    );
    expect(result.ok).toBe(false);
    expect(deps.uploadObject).not.toHaveBeenCalled();
  });

  it("rejects oversize files on the server", async () => {
    const deps = baseDeps();
    const result = await upsertMerchantCover(
      MERCHANT_A,
      {
        mimeType: "image/jpeg",
        sizeBytes: MERCHANT_COVER_MAX_BYTES + 1,
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

  it("replaces previous cover after the new path is saved", async () => {
    const deps = baseDeps({
      findMerchantCover: vi.fn(async () => ({
        id: MERCHANT_A,
        coverImagePath: PATH_A,
      })),
    });
    const result = await upsertMerchantCover(
      MERCHANT_A,
      { mimeType: "image/webp", sizeBytes: 1200, bytes: Buffer.from("fake") },
      deps,
    );
    expect(result.ok).toBe(true);
    expect(deps.setMerchantCoverPath).toHaveBeenCalledWith(
      MERCHANT_A,
      PATH_NEW,
    );
    expect(deps.deleteObject).toHaveBeenCalledWith(PATH_A);
  });

  it("keeps the new cover if deleting the old object fails", async () => {
    const deps = baseDeps({
      findMerchantCover: vi.fn(async () => ({
        id: MERCHANT_A,
        coverImagePath: PATH_A,
      })),
      deleteObject: vi.fn(async () => {
        throw new Error("storage down");
      }),
    });
    const result = await upsertMerchantCover(
      MERCHANT_A,
      { mimeType: "image/webp", sizeBytes: 1200, bytes: Buffer.from("fake") },
      deps,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.coverImagePath).toBe(PATH_NEW);
    }
  });

  it("cleans up the uploaded object if DB persist fails", async () => {
    const deps = baseDeps({
      setMerchantCoverPath: vi.fn(async () => null),
    });
    const result = await upsertMerchantCover(
      MERCHANT_A,
      { mimeType: "image/jpeg", sizeBytes: 100, bytes: Buffer.from("x") },
      deps,
    );
    expect(result.ok).toBe(false);
    expect(deps.deleteObject).toHaveBeenCalledWith(PATH_NEW);
  });

  it("allows owner and staff via requireCoverAccess", async () => {
    const deps = baseDeps();
    await upsertMerchantCover(
      MERCHANT_A,
      { mimeType: "image/png", sizeBytes: 100, bytes: Buffer.from("x") },
      deps,
    );
    expect(deps.requireCoverAccess).toHaveBeenCalledWith(MERCHANT_A);
  });

  it("denies cross-merchant writes", async () => {
    const deps = baseDeps({
      requireCoverAccess: vi.fn(async () => {
        throw new AuthzError("NOT_MERCHANT_MEMBER", "no");
      }),
    });
    await expect(
      upsertMerchantCover(
        MERCHANT_B,
        { mimeType: "image/jpeg", sizeBytes: 100, bytes: Buffer.from("x") },
        deps,
      ),
    ).rejects.toBeInstanceOf(AuthzError);
    expect(deps.uploadObject).not.toHaveBeenCalled();
  });
});

describe("deleteMerchantCover", () => {
  it("clears the path and deletes the object", async () => {
    const deps = baseDeps({
      findMerchantCover: vi.fn(async () => ({
        id: MERCHANT_A,
        coverImagePath: PATH_A,
      })),
    });
    const result = await deleteMerchantCover(MERCHANT_A, deps);
    expect(result.ok).toBe(true);
    expect(deps.setMerchantCoverPath).toHaveBeenCalledWith(MERCHANT_A, null);
    expect(deps.deleteObject).toHaveBeenCalledWith(PATH_A);
  });

  it("is idempotent when coverImagePath is already null", async () => {
    const deps = baseDeps();
    const result = await deleteMerchantCover(MERCHANT_A, deps);
    expect(result.ok).toBe(true);
    expect(deps.deleteObject).not.toHaveBeenCalled();
  });

  it("denies delete for another merchant", async () => {
    const deps = baseDeps({
      requireCoverAccess: vi.fn(async () => {
        throw new AuthzError("NOT_MERCHANT_MEMBER", "no");
      }),
    });
    await expect(deleteMerchantCover(MERCHANT_B, deps)).rejects.toBeInstanceOf(
      AuthzError,
    );
  });
});
