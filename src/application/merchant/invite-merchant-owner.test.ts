import { describe, expect, it, vi } from "vitest";
import { AuthzError } from "@/server/auth/errors";
import {
  inviteMerchantOwner,
  type InviteMerchantOwnerDeps,
} from "./invite-merchant-owner";

function baseDeps(
  overrides: Partial<InviteMerchantOwnerDeps> = {},
): InviteMerchantOwnerDeps {
  return {
    requirePlatformAdmin: vi.fn(async () => undefined),
    findMerchantById: vi.fn(async () => ({ id: "m-1" })),
    findAuthUserByEmail: vi.fn(async () => null),
    inviteAuthUser: vi.fn(async () => ({
      id: "user-new",
      email: "owner@example.com",
      emailConfirmed: false,
    })),
    ensureUserProfile: vi.fn(async () => undefined),
    findMembership: vi.fn(async () => null),
    insertOwnerMembership: vi.fn(async () => undefined),
    getInviteRedirectTo: () =>
      "http://localhost:3001/auth/confirm?next=%2Fset-password",
    secretConfigured: () => true,
    ...overrides,
  };
}

describe("inviteMerchantOwner", () => {
  it("requires platform admin before any admin API", async () => {
    const order: string[] = [];
    const deps = baseDeps({
      requirePlatformAdmin: vi.fn(async () => {
        order.push("admin");
      }),
      findAuthUserByEmail: vi.fn(async () => {
        order.push("lookup");
        return null;
      }),
      inviteAuthUser: vi.fn(async () => {
        order.push("invite");
        return {
          id: "u1",
          email: "o@e.com",
          emailConfirmed: false,
        };
      }),
    });

    await inviteMerchantOwner({ merchantId: "m-1", email: "o@e.com" }, deps);
    expect(order[0]).toBe("admin");
    expect(order).toContain("lookup");
    expect(order).toContain("invite");
  });

  it("new user: invite + membership OWNER", async () => {
    const deps = baseDeps();
    const result = await inviteMerchantOwner(
      { merchantId: "m-1", email: " Owner@Example.com ", displayName: "Ana" },
      deps,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.kind).toBe("INVITED_NEW_USER");
    }
    expect(deps.inviteAuthUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "owner@example.com",
        displayName: "Ana",
      }),
    );
    expect(deps.insertOwnerMembership).toHaveBeenCalledWith({
      merchantId: "m-1",
      userId: "user-new",
    });
  });

  it("existing confirmed user: no invite, assign OWNER", async () => {
    const deps = baseDeps({
      findAuthUserByEmail: vi.fn(async () => ({
        id: "user-existing",
        email: "owner@example.com",
        emailConfirmed: true,
      })),
    });
    const result = await inviteMerchantOwner(
      { merchantId: "m-1", email: "owner@example.com" },
      deps,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.kind).toBe("ASSIGNED_EXISTING_CONFIRMED");
      expect(result.value.message).toMatch(/existente/i);
    }
    expect(deps.inviteAuthUser).not.toHaveBeenCalled();
    expect(deps.insertOwnerMembership).toHaveBeenCalled();
  });

  it("existing pending user: no duplicate Auth invite", async () => {
    const deps = baseDeps({
      findAuthUserByEmail: vi.fn(async () => ({
        id: "user-pending",
        email: "owner@example.com",
        emailConfirmed: false,
      })),
    });
    const result = await inviteMerchantOwner(
      { merchantId: "m-1", email: "owner@example.com" },
      deps,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.kind).toBe("ASSIGNED_EXISTING_PENDING");
      expect(result.value.message).toMatch(/pendiente/i);
    }
    expect(deps.inviteAuthUser).not.toHaveBeenCalled();
  });

  it("duplicate OWNER invite is idempotent", async () => {
    const deps = baseDeps({
      findAuthUserByEmail: vi.fn(async () => ({
        id: "user-existing",
        email: "owner@example.com",
        emailConfirmed: true,
      })),
      findMembership: vi.fn(async () => ({ role: "OWNER", active: true })),
    });
    const result = await inviteMerchantOwner(
      { merchantId: "m-1", email: "owner@example.com" },
      deps,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.kind).toBe("ALREADY_OWNER");
    }
    expect(deps.insertOwnerMembership).not.toHaveBeenCalled();
  });

  it("does not silently elevate STAFF to OWNER", async () => {
    const deps = baseDeps({
      findAuthUserByEmail: vi.fn(async () => ({
        id: "user-staff",
        email: "staff@example.com",
        emailConfirmed: true,
      })),
      findMembership: vi.fn(async () => ({ role: "STAFF", active: true })),
    });
    const result = await inviteMerchantOwner(
      { merchantId: "m-1", email: "staff@example.com" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STAFF_CONFLICT");
    }
    expect(deps.insertOwnerMembership).not.toHaveBeenCalled();
  });

  it("rejects invalid email", async () => {
    const deps = baseDeps();
    const result = await inviteMerchantOwner(
      { merchantId: "m-1", email: "nope" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_EMAIL");
    }
  });

  it("requires secret configuration", async () => {
    const deps = baseDeps({ secretConfigured: () => false });
    const result = await inviteMerchantOwner(
      { merchantId: "m-1", email: "a@b.com" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SECRET_MISSING");
    }
  });

  it("surfaces invite failure without deleting auth user", async () => {
    const deps = baseDeps({
      inviteAuthUser: vi.fn(async () => {
        throw new Error("smtp down");
      }),
    });
    const result = await inviteMerchantOwner(
      { merchantId: "m-1", email: "a@b.com" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVITE_FAILED");
    }
  });

  it("requires admin authorization", async () => {
    const deps = baseDeps({
      requirePlatformAdmin: vi.fn(async () => {
        throw new AuthzError("UNAUTHENTICATED", "no");
      }),
    });
    await expect(
      inviteMerchantOwner({ merchantId: "m-1", email: "a@b.com" }, deps),
    ).rejects.toBeInstanceOf(AuthzError);
    expect(deps.findAuthUserByEmail).not.toHaveBeenCalled();
  });
});
