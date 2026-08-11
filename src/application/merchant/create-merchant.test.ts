import { describe, expect, it, vi } from "vitest";
import { AuthzError } from "@/server/auth/errors";
import { createMerchant, type CreateMerchantDeps } from "./create-merchant";

function baseDeps(
  overrides: Partial<CreateMerchantDeps> = {},
): CreateMerchantDeps {
  return {
    requirePlatformAdmin: vi.fn(async () => undefined),
    findCityById: vi.fn(async () => ({ id: "city-1" })),
    findZoneById: vi.fn(async () => ({ id: "zone-1", cityId: "city-1" })),
    findMerchantBySlug: vi.fn(async () => null),
    insertMerchantDraft: vi.fn(async () => ({
      id: "m-1",
      status: "DRAFT",
      platformDeliveryEnabled: false,
    })),
    isUniqueViolation: () => false,
    ...overrides,
  };
}

const validInput = {
  name: "Panadería Norte",
  slug: "panaderia-norte",
  description: "Test",
  cityId: "city-1",
  zoneId: "zone-1",
  pickupEnabled: true,
  merchantDeliveryEnabled: false,
  preparationMinutes: 25,
};

describe("createMerchant", () => {
  it("rejects unauthenticated / non-admin via requirePlatformAdmin", async () => {
    const deps = baseDeps({
      requirePlatformAdmin: vi.fn(async () => {
        throw new AuthzError("NOT_PLATFORM_ADMIN", "no");
      }),
    });
    await expect(createMerchant(validInput, deps)).rejects.toBeInstanceOf(
      AuthzError,
    );
  });

  it("rejects USER by authorize gate", async () => {
    const deps = baseDeps({
      requirePlatformAdmin: vi.fn(async () => {
        throw new AuthzError("NOT_PLATFORM_ADMIN", "User cannot");
      }),
    });
    await expect(createMerchant(validInput, deps)).rejects.toMatchObject({
      code: "NOT_PLATFORM_ADMIN",
    });
  });

  it("rejects suspended admin", async () => {
    const deps = baseDeps({
      requirePlatformAdmin: vi.fn(async () => {
        throw new AuthzError("USER_SUSPENDED", "suspended");
      }),
    });
    await expect(createMerchant(validInput, deps)).rejects.toMatchObject({
      code: "USER_SUSPENDED",
    });
  });

  it("ADMIN creates DRAFT with platformDeliveryEnabled false", async () => {
    const deps = baseDeps();
    const result = await createMerchant(
      {
        ...validInput,
        status: "ACTIVE",
        platformDeliveryEnabled: true,
      },
      deps,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("DRAFT");
      expect(result.value.platformDeliveryEnabled).toBe(false);
    }
    expect(deps.insertMerchantDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Panadería Norte",
        slug: "panaderia-norte",
      }),
    );
  });

  it("rejects zone that does not belong to city", async () => {
    const deps = baseDeps({
      findZoneById: vi.fn(async () => ({ id: "zone-1", cityId: "other" })),
    });
    const result = await createMerchant(validInput, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ZONE_CITY_MISMATCH");
    }
  });

  it("rejects duplicate slug", async () => {
    const deps = baseDeps({
      findMerchantBySlug: vi.fn(async () => ({ id: "existing" })),
    });
    const result = await createMerchant(validInput, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DUPLICATE_SLUG");
    }
  });

  it("rejects invalid fields", async () => {
    const deps = baseDeps();
    const result = await createMerchant(
      { ...validInput, name: "  ", preparationMinutes: -1 },
      deps,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects unknown city", async () => {
    const deps = baseDeps({
      findCityById: vi.fn(async () => null),
    });
    const result = await createMerchant(validInput, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CITY_NOT_FOUND");
    }
  });
});
