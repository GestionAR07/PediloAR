import { describe, expect, it, vi } from "vitest";
import { AuthzError } from "@/server/auth/errors";
import type { MerchantApplicationRecord } from "@/infrastructure/db/repositories/merchant-application-repository";
import type { MerchantDetailRecord } from "@/infrastructure/db/repositories/merchant-repository";
import {
  approveMerchantApplication,
  rejectMerchantApplication,
  submitMerchantApplication,
  type ApproveMerchantApplicationDeps,
  type RejectMerchantApplicationDeps,
  type SubmitMerchantApplicationDeps,
} from "./merchant-applications";

const CITY_ID = "11111111-1111-4111-8111-111111111111";
const ZONE_ID = "22222222-2222-4222-8222-222222222222";

const pendingApplication = (): MerchantApplicationRecord => ({
  id: "app-1",
  status: "PENDING",
  businessName: "Panadería Norte",
  contactName: "Ana",
  contactEmail: "ana@example.com",
  contactPhone: "2804123456",
  cityId: CITY_ID,
  zoneId: ZONE_ID,
  cityName: "Rawson",
  zoneName: "Centro",
  description: "Pan artesanal",
  message: "Quiero sumarme",
  merchantId: null,
  reviewedAt: null,
  reviewedByUserId: null,
  rejectionReason: "",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

const draftMerchant = (): MerchantDetailRecord => ({
  id: "merchant-1",
  name: "Panadería Norte",
  slug: "panaderia-norte",
  description: "Pan artesanal",
  status: "DRAFT",
  cityId: CITY_ID,
  zoneId: ZONE_ID,
  cityName: "Rawson",
  zoneName: "Centro",
  pickupEnabled: true,
  merchantDeliveryEnabled: false,
  platformDeliveryEnabled: false,
  preparationMinutes: 20,
  acceptingOrders: true,
  pausedUntil: null,
  cityTimezone: "America/Argentina/Buenos_Aires",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

function submitDeps(
  overrides: Partial<SubmitMerchantApplicationDeps> = {},
): SubmitMerchantApplicationDeps {
  return {
    findCityById: vi.fn(async () => ({ id: CITY_ID })),
    findZoneById: vi.fn(async () => ({ id: ZONE_ID, cityId: CITY_ID })),
    findPendingDuplicate: vi.fn(async () => null),
    countPendingMerchantApplicationsByEmail: vi.fn(async () => 0),
    insertMerchantApplication: vi.fn(async () => pendingApplication()),
    ...overrides,
  };
}

function approveDeps(
  overrides: Partial<ApproveMerchantApplicationDeps> = {},
): ApproveMerchantApplicationDeps {
  const tx = { id: "tx-1" };
  return {
    requirePlatformAdmin: vi.fn(async () => ({
      user: { id: "admin-1", email: "admin@example.com" },
      profile: {
        id: "admin-1",
        platformRole: "ADMIN" as const,
        status: "ACTIVE" as const,
        displayName: "Admin",
        phone: null,
      },
    })),
    findMerchantBySlug: vi.fn(async () => null),
    runTransaction: vi.fn(async (fn) => fn(tx as never)),
    findMerchantApplicationById: vi.fn(async () => pendingApplication()),
    insertMerchantDraft: vi.fn(async () => draftMerchant()),
    markApproved: vi.fn(async () => ({
      ...pendingApplication(),
      status: "APPROVED",
      merchantId: "merchant-1",
      reviewedByUserId: "admin-1",
      reviewedAt: new Date("2026-01-02T00:00:00.000Z"),
    })),
    isUniqueViolation: () => false,
    ...overrides,
  };
}

function rejectDeps(
  overrides: Partial<RejectMerchantApplicationDeps> = {},
): RejectMerchantApplicationDeps {
  return {
    requirePlatformAdmin: vi.fn(async () => ({
      user: { id: "admin-1", email: "admin@example.com" },
      profile: {
        id: "admin-1",
        platformRole: "ADMIN" as const,
        status: "ACTIVE" as const,
        displayName: "Admin",
        phone: null,
      },
    })),
    markRejected: vi.fn(async () => ({
      ...pendingApplication(),
      status: "REJECTED",
      reviewedByUserId: "admin-1",
      reviewedAt: new Date("2026-01-02T00:00:00.000Z"),
      rejectionReason: "Datos incompletos",
    })),
    ...overrides,
  };
}

const validSubmitInput = {
  businessName: "Panadería Norte",
  contactName: "Ana",
  contactEmail: "ana@example.com",
  contactPhone: "2804123456",
  cityId: CITY_ID,
  zoneId: ZONE_ID,
  description: "Pan artesanal",
  message: "Quiero sumarme",
};

function repeatChar(length: number, char = "a"): string {
  return char.repeat(length);
}

const validApproveInput = {
  applicationId: "app-1",
  slug: "panaderia-norte",
  pickupEnabled: true,
  merchantDeliveryEnabled: false,
  preparationMinutes: 20,
};

describe("submitMerchantApplication", () => {
  it("creates a pending application on success", async () => {
    const deps = submitDeps();
    const result = await submitMerchantApplication(validSubmitInput, deps);
    expect(result.ok).toBe(true);
    expect(deps.insertMerchantApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        businessName: "Panadería Norte",
        contactEmail: "ana@example.com",
        cityId: CITY_ID,
        zoneId: ZONE_ID,
      }),
    );
  });

  it.each([
    ["businessName", "BUSINESS_NAME_TOO_LONG", 121],
    ["contactName", "CONTACT_NAME_TOO_LONG", 81],
    ["contactEmail", "EMAIL_TOO_LONG", 255],
    ["contactPhone", "PHONE_TOO_LONG", 33],
    ["description", "DESCRIPTION_TOO_LONG", 2001],
    ["message", "MESSAGE_TOO_LONG", 2001],
  ] as const)(
    "rejects %s longer than the limit",
    async (field, code, length) => {
      const deps = submitDeps();
      const value =
        field === "contactEmail"
          ? `${repeatChar(length - "@example.com".length)}@example.com`
          : repeatChar(length);
      const result = await submitMerchantApplication(
        { ...validSubmitInput, [field]: value },
        deps,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(code);
      }
      expect(deps.findCityById).not.toHaveBeenCalled();
      expect(deps.insertMerchantApplication).not.toHaveBeenCalled();
    },
  );

  it("rejects malformed cityId without calling findCityById", async () => {
    const deps = submitDeps();
    const result = await submitMerchantApplication(
      { ...validSubmitInput, cityId: "abc" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_CITY_ID");
    }
    expect(deps.findCityById).not.toHaveBeenCalled();
    expect(deps.findZoneById).not.toHaveBeenCalled();
    expect(deps.insertMerchantApplication).not.toHaveBeenCalled();
  });

  it("rejects malformed zoneId without calling findZoneById", async () => {
    const deps = submitDeps();
    const result = await submitMerchantApplication(
      { ...validSubmitInput, zoneId: "not-a-uuid" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_ZONE_ID");
    }
    expect(deps.findCityById).not.toHaveBeenCalled();
    expect(deps.findZoneById).not.toHaveBeenCalled();
    expect(deps.insertMerchantApplication).not.toHaveBeenCalled();
  });

  it("rejects invalid email and geography", async () => {
    const deps = submitDeps();
    const emailResult = await submitMerchantApplication(
      { ...validSubmitInput, contactEmail: "not-an-email" },
      deps,
    );
    expect(emailResult.ok).toBe(false);
    if (!emailResult.ok) {
      expect(emailResult.error.code).toBe("INVALID_EMAIL");
    }

    const geoDeps = submitDeps({
      findZoneById: vi.fn(async () => ({
        id: ZONE_ID,
        cityId: "33333333-3333-4333-8333-333333333333",
      })),
    });
    const geoResult = await submitMerchantApplication(
      validSubmitInput,
      geoDeps,
    );
    expect(geoResult.ok).toBe(false);
    if (!geoResult.ok) {
      expect(geoResult.error.code).toBe("ZONE_CITY_MISMATCH");
    }
    expect(deps.insertMerchantApplication).not.toHaveBeenCalled();
  });

  it("does not insert when a pending duplicate exists", async () => {
    const deps = submitDeps({
      findPendingDuplicate: vi.fn(async () => pendingApplication()),
    });
    const result = await submitMerchantApplication(validSubmitInput, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PENDING_DUPLICATE");
    }
    expect(deps.insertMerchantApplication).not.toHaveBeenCalled();
  });

  it("blocks the fourth pending application for the same email", async () => {
    const deps = submitDeps({
      countPendingMerchantApplicationsByEmail: vi.fn(async () => 3),
    });
    const result = await submitMerchantApplication(validSubmitInput, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TOO_MANY_PENDING_FOR_EMAIL");
    }
    expect(deps.insertMerchantApplication).not.toHaveBeenCalled();
  });

  it("allows submit when only two pending applications exist for the email", async () => {
    const deps = submitDeps({
      countPendingMerchantApplicationsByEmail: vi.fn(async () => 2),
    });
    const result = await submitMerchantApplication(validSubmitInput, deps);
    expect(result.ok).toBe(true);
    expect(deps.countPendingMerchantApplicationsByEmail).toHaveBeenCalledWith(
      "ana@example.com",
    );
    expect(deps.insertMerchantApplication).toHaveBeenCalled();
  });
});

describe("approveMerchantApplication", () => {
  it("uses reviewer id from platform admin auth", async () => {
    const deps = approveDeps();
    const result = await approveMerchantApplication(validApproveInput, deps);
    expect(result.ok).toBe(true);
    expect(deps.requirePlatformAdmin).toHaveBeenCalled();
    expect(deps.markApproved).toHaveBeenCalledWith(
      expect.objectContaining({ reviewedByUserId: "admin-1" }),
      expect.anything(),
    );
  });

  it("creates a DRAFT merchant from the application inside the transaction", async () => {
    const deps = approveDeps();
    const result = await approveMerchantApplication(validApproveInput, deps);
    expect(result.ok).toBe(true);
    expect(deps.insertMerchantDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Panadería Norte",
        slug: "panaderia-norte",
        description: "Pan artesanal",
        cityId: CITY_ID,
        zoneId: ZONE_ID,
        pickupEnabled: true,
        merchantDeliveryEnabled: false,
        preparationMinutes: 20,
      }),
      expect.anything(),
    );
  });

  it("passes the same transaction client to merchant insert and markApproved", async () => {
    const sharedTx = { id: "shared-tx" };
    const insertMerchantDraft = vi.fn(async (_input, tx) => {
      expect(tx).toBe(sharedTx);
      return draftMerchant();
    });
    const markApproved = vi.fn(async (_input, tx) => {
      expect(tx).toBe(sharedTx);
      return {
        ...pendingApplication(),
        status: "APPROVED",
        merchantId: "merchant-1",
        reviewedByUserId: "admin-1",
        reviewedAt: new Date(),
      };
    });
    const deps = approveDeps({
      runTransaction: vi.fn(async (fn) => fn(sharedTx as never)),
      insertMerchantDraft,
      markApproved,
    });

    await approveMerchantApplication(validApproveInput, deps);
    expect(insertMerchantDraft).toHaveBeenCalledOnce();
    expect(markApproved).toHaveBeenCalledOnce();
  });

  it("does not create a merchant when the application is not pending", async () => {
    const deps = approveDeps({
      findMerchantApplicationById: vi.fn(async () => ({
        ...pendingApplication(),
        status: "APPROVED",
      })),
    });
    const result = await approveMerchantApplication(validApproveInput, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("APPLICATION_NOT_PENDING");
    }
    expect(deps.insertMerchantDraft).not.toHaveBeenCalled();
    expect(deps.markApproved).not.toHaveBeenCalled();
  });

  it("rejects duplicate slug before opening the transaction", async () => {
    const deps = approveDeps({
      findMerchantBySlug: vi.fn(async () => ({ id: "existing" })),
    });
    const result = await approveMerchantApplication(validApproveInput, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DUPLICATE_SLUG");
    }
    expect(deps.runTransaction).not.toHaveBeenCalled();
  });

  it("aborts approval when markApproved returns null inside the transaction", async () => {
    const deps = approveDeps({
      markApproved: vi.fn(async () => null),
    });
    const result = await approveMerchantApplication(validApproveInput, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("APPROVAL_MARK_FAILED");
    }
    expect(deps.insertMerchantDraft).toHaveBeenCalled();
    expect(deps.markApproved).toHaveBeenCalled();
  });

  it("rejects non-admin callers before approval", async () => {
    const deps = approveDeps({
      requirePlatformAdmin: vi.fn(async () => {
        throw new AuthzError("NOT_PLATFORM_ADMIN", "no");
      }),
    });
    await expect(
      approveMerchantApplication(validApproveInput, deps),
    ).rejects.toBeInstanceOf(AuthzError);
  });
});

describe("rejectMerchantApplication", () => {
  it("requires a rejection reason", async () => {
    const deps = rejectDeps();
    const result = await rejectMerchantApplication(
      { applicationId: "app-1", rejectionReason: "   " },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_REJECTION_REASON");
    }
    expect(deps.markRejected).not.toHaveBeenCalled();
  });

  it("uses reviewer id from platform admin auth", async () => {
    const deps = rejectDeps();
    const result = await rejectMerchantApplication(
      { applicationId: "app-1", rejectionReason: "Datos incompletos" },
      deps,
    );
    expect(result.ok).toBe(true);
    expect(deps.markRejected).toHaveBeenCalledWith({
      applicationId: "app-1",
      reviewedByUserId: "admin-1",
      rejectionReason: "Datos incompletos",
    });
  });

  it("returns not found when the application is not pending", async () => {
    const deps = rejectDeps({
      markRejected: vi.fn(async () => null),
    });
    const result = await rejectMerchantApplication(
      { applicationId: "app-1", rejectionReason: "Datos incompletos" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("APPLICATION_NOT_FOUND_OR_NOT_PENDING");
    }
  });
});
