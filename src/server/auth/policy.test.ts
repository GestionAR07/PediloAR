import { describe, expect, it } from "vitest";
import { AuthzError } from "./errors";
import {
  assertActiveProfile,
  assertAuthenticated,
  assertMerchantMembership,
  assertMerchantRole,
  assertPlatformAdmin,
} from "./policy";
import type { MerchantMembership, UserProfileRecord } from "./types";

const activeUser: UserProfileRecord = {
  id: "user-1",
  platformRole: "USER",
  status: "ACTIVE",
  displayName: "User",
  phone: null,
};

const admin: UserProfileRecord = {
  id: "admin-1",
  platformRole: "ADMIN",
  status: "ACTIVE",
  displayName: "Admin",
  phone: null,
};

const ownerMembership: MerchantMembership = {
  merchantId: "m-1",
  merchantName: "Panadería",
  role: "OWNER",
  active: true,
  merchantStatus: "DRAFT",
  cityName: "Rawson",
  zoneName: "Centro",
};

const staffMembership: MerchantMembership = {
  merchantId: "m-1",
  merchantName: "Panadería",
  role: "STAFF",
  active: true,
  merchantStatus: "DRAFT",
  cityName: "Rawson",
  zoneName: "Centro",
};

describe("authorization policy", () => {
  it("requireAuthenticated rejects null", () => {
    expect(() => assertAuthenticated(null)).toThrow(AuthzError);
    try {
      assertAuthenticated(null);
    } catch (error) {
      expect((error as AuthzError).code).toBe("UNAUTHENTICATED");
    }
  });

  it("ACTIVE profile passes; SUSPENDED fails", () => {
    expect(assertActiveProfile(activeUser).status).toBe("ACTIVE");
    expect(() =>
      assertActiveProfile({ ...activeUser, status: "SUSPENDED" }),
    ).toThrow(AuthzError);
    try {
      assertActiveProfile({ ...activeUser, status: "SUSPENDED" });
    } catch (error) {
      expect((error as AuthzError).code).toBe("USER_SUSPENDED");
    }
  });

  it("platform admin requires ADMIN role", () => {
    expect(() => assertPlatformAdmin(activeUser)).toThrow(AuthzError);
    try {
      assertPlatformAdmin(activeUser);
    } catch (error) {
      expect((error as AuthzError).code).toBe("NOT_PLATFORM_ADMIN");
    }
    expect(() => assertPlatformAdmin(admin)).not.toThrow();
  });

  it("merchant membership requires matching active row", () => {
    expect(assertMerchantMembership([ownerMembership], "m-1").role).toBe(
      "OWNER",
    );

    expect(() =>
      assertMerchantMembership([ownerMembership], "m-other"),
    ).toThrow(AuthzError);

    expect(() =>
      assertMerchantMembership([{ ...ownerMembership, active: false }], "m-1"),
    ).toThrow(AuthzError);
  });

  it("OWNER and STAFF roles are enforced deliberately", () => {
    expect(() => assertMerchantRole(ownerMembership, ["OWNER"])).not.toThrow();
    expect(() => assertMerchantRole(staffMembership, ["STAFF"])).not.toThrow();
    expect(() => assertMerchantRole(staffMembership, ["OWNER"])).toThrow(
      AuthzError,
    );
    try {
      assertMerchantRole(staffMembership, ["OWNER"]);
    } catch (error) {
      expect((error as AuthzError).code).toBe("MERCHANT_ROLE_FORBIDDEN");
    }
  });

  it("foreign user without membership is rejected", () => {
    try {
      assertMerchantMembership([], "m-1");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AuthzError);
      expect((error as AuthzError).code).toBe("NOT_MERCHANT_MEMBER");
    }
  });
});
