import { describe, expect, it, vi } from "vitest";
import { AuthzError } from "@/server/auth/errors";
import {
  activateMerchant,
  getMerchantActivationBlockers,
  type ActivateMerchantDeps,
  type MerchantActivationReadiness,
} from "./activate-merchant";

const readyMerchant: MerchantActivationReadiness = {
  merchantId: "merchant-1",
  status: "DRAFT",
  pickupEnabled: true,
  merchantDeliveryEnabled: false,
  activeOwnerCount: 1,
  activeDeliveryZoneCount: 0,
  activePaymentMethodCount: 1,
  activeCatalogProductCount: 1,
};

function baseDeps(
  overrides: Partial<ActivateMerchantDeps> = {},
): ActivateMerchantDeps {
  return {
    requirePlatformAdmin: vi.fn(async () => undefined),
    findActivationReadiness: vi.fn(async () => readyMerchant),
    activateDraftMerchant: vi.fn(async () => ({
      id: "merchant-1",
      status: "ACTIVE",
    })),
    ...overrides,
  };
}

describe("merchant activation", () => {
  it("requires platform admin authorization", async () => {
    const deps = baseDeps({
      requirePlatformAdmin: vi.fn(async () => {
        throw new AuthzError("NOT_PLATFORM_ADMIN", "forbidden");
      }),
    });

    await expect(activateMerchant("merchant-1", deps)).rejects.toMatchObject({
      code: "NOT_PLATFORM_ADMIN",
    });
    expect(deps.activateDraftMerchant).not.toHaveBeenCalled();
  });

  it("activates a ready DRAFT merchant", async () => {
    const deps = baseDeps();
    const result = await activateMerchant("merchant-1", deps);

    expect(result).toEqual({
      ok: true,
      value: {
        merchantId: "merchant-1",
        status: "ACTIVE",
        alreadyActive: false,
      },
    });
    expect(deps.activateDraftMerchant).toHaveBeenCalledWith("merchant-1");
  });

  it("is idempotent for an already ACTIVE merchant", async () => {
    const deps = baseDeps({
      findActivationReadiness: vi.fn(async () => ({
        ...readyMerchant,
        status: "ACTIVE",
      })),
    });

    const result = await activateMerchant("merchant-1", deps);

    expect(result).toEqual({
      ok: true,
      value: {
        merchantId: "merchant-1",
        status: "ACTIVE",
        alreadyActive: true,
      },
    });
    expect(deps.activateDraftMerchant).not.toHaveBeenCalled();
  });

  it("does not reactivate a SUSPENDED merchant through onboarding", async () => {
    const deps = baseDeps({
      findActivationReadiness: vi.fn(async () => ({
        ...readyMerchant,
        status: "SUSPENDED",
      })),
    });

    const result = await activateMerchant("merchant-1", deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_STATUS");
    }
    expect(deps.activateDraftMerchant).not.toHaveBeenCalled();
  });

  it("reports every readiness blocker without writing", async () => {
    const notReady: MerchantActivationReadiness = {
      ...readyMerchant,
      pickupEnabled: false,
      merchantDeliveryEnabled: true,
      activeOwnerCount: 0,
      activeDeliveryZoneCount: 0,
      activePaymentMethodCount: 0,
      activeCatalogProductCount: 0,
    };
    const deps = baseDeps({
      findActivationReadiness: vi.fn(async () => notReady),
    });

    const result = await activateMerchant("merchant-1", deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MERCHANT_NOT_READY");
      expect(result.error.blockers).toEqual([
        "OWNER_REQUIRED",
        "DELIVERY_ZONE_REQUIRED",
        "PAYMENT_METHOD_REQUIRED",
        "CATALOG_PRODUCT_REQUIRED",
      ]);
    }
    expect(deps.activateDraftMerchant).not.toHaveBeenCalled();
  });

  it("requires at least one fulfillment method", () => {
    expect(
      getMerchantActivationBlockers({
        ...readyMerchant,
        pickupEnabled: false,
        merchantDeliveryEnabled: false,
      }),
    ).toContain("FULFILLMENT_REQUIRED");
  });

  it("handles missing merchants and failed conditional updates", async () => {
    const missing = await activateMerchant(
      "merchant-1",
      baseDeps({ findActivationReadiness: vi.fn(async () => null) }),
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("MERCHANT_NOT_FOUND");

    const failed = await activateMerchant(
      "merchant-1",
      baseDeps({ activateDraftMerchant: vi.fn(async () => null) }),
    );
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.error.code).toBe("ACTIVATION_FAILED");
  });
});
