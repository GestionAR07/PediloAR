import { describe, expect, it } from "vitest";
import { AuthzError } from "@/server/auth/errors";
import {
  assertMerchantMembership,
  assertMerchantRole,
} from "@/server/auth/policy";
import type { MerchantMembership } from "@/server/auth/types";

const membershipA: MerchantMembership = {
  merchantId: "merchant-a",
  merchantName: "A",
  role: "OWNER",
  active: true,
  merchantStatus: "DRAFT",
  cityName: "Rawson",
  zoneName: "Centro",
};

describe("cross-merchant isolation (policy)", () => {
  it("owner of A cannot access merchant B by id", () => {
    expect(() => assertMerchantMembership([membershipA], "merchant-b")).toThrow(
      AuthzError,
    );
    try {
      assertMerchantMembership([membershipA], "merchant-b");
    } catch (error) {
      expect((error as AuthzError).code).toBe("NOT_MERCHANT_MEMBER");
    }
  });

  it("allows matching merchant and role", () => {
    const m = assertMerchantMembership([membershipA], "merchant-a");
    expect(() => assertMerchantRole(m, ["OWNER", "STAFF"])).not.toThrow();
  });
});
