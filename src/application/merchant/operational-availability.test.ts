import { describe, expect, it, vi } from "vitest";
import { AuthzError } from "@/server/auth/errors";
import {
  pauseMerchantOrdersTemporarily,
  pauseMerchantOrdersUntilManualResume,
  resumeMerchantOrders,
  type MerchantOperationalDeps,
} from "./operational-availability";

const MERCHANT_A = "11111111-1111-4111-8111-111111111111";
const MERCHANT_B = "22222222-2222-4222-8222-222222222222";

const activeMerchant = {
  id: MERCHANT_A,
  status: "ACTIVE" as const,
  acceptingOrders: true,
  pausedUntil: null,
};

const fixedNow = new Date("2026-08-12T14:00:00.000Z");

function baseDeps(
  overrides: Partial<MerchantOperationalDeps> = {},
): MerchantOperationalDeps {
  return {
    requireOperationalAccess: vi.fn(async () => undefined),
    findMerchantOperationalState: vi.fn(async () => activeMerchant),
    setMerchantOperationalState: vi.fn(async (_id, state) => ({
      id: MERCHANT_A,
      ...state,
    })),
    now: () => fixedNow,
    ...overrides,
  };
}

describe("pauseMerchantOrdersTemporarily", () => {
  it("pauses for 15 minutes keeping acceptingOrders true", async () => {
    const deps = baseDeps();
    const result = await pauseMerchantOrdersTemporarily(MERCHANT_A, 15, deps);
    expect(result.ok).toBe(true);
    expect(deps.setMerchantOperationalState).toHaveBeenCalledWith(MERCHANT_A, {
      acceptingOrders: true,
      pausedUntil: new Date("2026-08-12T14:15:00.000Z"),
    });
  });

  it("pauses for 30 minutes", async () => {
    const deps = baseDeps();
    const result = await pauseMerchantOrdersTemporarily(MERCHANT_A, 30, deps);
    expect(result.ok).toBe(true);
    expect(deps.setMerchantOperationalState).toHaveBeenCalledWith(MERCHANT_A, {
      acceptingOrders: true,
      pausedUntil: new Date("2026-08-12T14:30:00.000Z"),
    });
  });

  it("pauses for 60 minutes", async () => {
    const deps = baseDeps();
    const result = await pauseMerchantOrdersTemporarily(MERCHANT_A, 60, deps);
    expect(result.ok).toBe(true);
    expect(deps.setMerchantOperationalState).toHaveBeenCalledWith(MERCHANT_A, {
      acceptingOrders: true,
      pausedUntil: new Date("2026-08-12T15:00:00.000Z"),
    });
  });

  it("rejects invalid duration", async () => {
    const result = await pauseMerchantOrdersTemporarily(
      MERCHANT_A,
      45,
      baseDeps(),
    );
    expect(result.ok).toBe(false);
  });
});

describe("pauseMerchantOrdersUntilManualResume", () => {
  it("sets acceptingOrders false and clears pausedUntil", async () => {
    const deps = baseDeps();
    const result = await pauseMerchantOrdersUntilManualResume(MERCHANT_A, deps);
    expect(result.ok).toBe(true);
    expect(deps.setMerchantOperationalState).toHaveBeenCalledWith(MERCHANT_A, {
      acceptingOrders: false,
      pausedUntil: null,
    });
  });
});

describe("resumeMerchantOrders", () => {
  it("clears pause and sets acceptingOrders true", async () => {
    const deps = baseDeps({
      findMerchantOperationalState: vi.fn(async () => ({
        ...activeMerchant,
        acceptingOrders: false,
      })),
    });
    const result = await resumeMerchantOrders(MERCHANT_A, deps);
    expect(result.ok).toBe(true);
    expect(deps.setMerchantOperationalState).toHaveBeenCalledWith(MERCHANT_A, {
      acceptingOrders: true,
      pausedUntil: null,
    });
  });
});

describe("merchant operational permissions", () => {
  it("denies cross-merchant when merchant not found in scope", async () => {
    const deps = baseDeps({
      findMerchantOperationalState: vi.fn(async () => null),
    });
    const result = await pauseMerchantOrdersTemporarily(MERCHANT_B, 30, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MERCHANT_NOT_FOUND");
    }
  });

  it("requires membership via requireOperationalAccess", async () => {
    const deps = baseDeps({
      requireOperationalAccess: vi.fn(async () => {
        throw new AuthzError("NOT_MERCHANT_MEMBER", "no");
      }),
    });
    await expect(
      pauseMerchantOrdersTemporarily(MERCHANT_A, 30, deps),
    ).rejects.toBeInstanceOf(AuthzError);
  });

  it("blocks pause when merchant is DRAFT", async () => {
    const deps = baseDeps({
      findMerchantOperationalState: vi.fn(async () => ({
        ...activeMerchant,
        status: "DRAFT" as const,
      })),
    });
    const result = await pauseMerchantOrdersTemporarily(MERCHANT_A, 30, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MERCHANT_NOT_ACTIVE");
    }
  });
});

describe("operational wiring security static", () => {
  it("uses requireMerchantRole for operational actions", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const wiring = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/application/merchant/operational-wiring.ts",
      ),
      "utf8",
    );
    expect(wiring).toContain("requireMerchantRole");
    expect(wiring).not.toContain("requirePlatformAdmin");
  });
});
