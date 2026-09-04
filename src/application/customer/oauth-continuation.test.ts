import { describe, expect, it } from "vitest";
import {
  resolveOAuthContinueRedirect,
  resolveOAuthDestination,
} from "./oauth-continuation";

describe("OAuth continuation", () => {
  it("preserves an explicit safe checkout destination", () => {
    expect(
      resolveOAuthDestination({
        requestedNext: "/checkout",
        platformRole: "USER",
        memberships: [{ merchantId: "merchant-1" }],
      }),
    ).toBe("/checkout");
  });

  it("rejects external destinations and preserves shared-login defaults", () => {
    expect(
      resolveOAuthDestination({
        requestedNext: "https://evil.test",
        platformRole: "ADMIN",
        memberships: [],
      }),
    ).toBe("/admin");
    expect(
      resolveOAuthDestination({
        platformRole: "USER",
        memberships: [{ merchantId: "merchant-1" }],
      }),
    ).toBe("/merchant/merchant-1");
    expect(
      resolveOAuthDestination({
        platformRole: "USER",
        memberships: [],
      }),
    ).toBe("/cuenta");
  });

  it("keeps an existing Owner on the merchant workspace without new-customer onboarding", () => {
    expect(
      resolveOAuthContinueRedirect({
        destination: "/merchant/merchant-1",
        profile: { displayName: "Ana Owner", phone: null },
      }),
    ).toBe("/merchant/merchant-1");
    expect(
      resolveOAuthContinueRedirect({
        destination: "/admin",
        profile: { displayName: null, phone: null },
      }),
    ).toBe("/admin");
  });

  it("asks only for the missing buyer contact fields", () => {
    expect(
      resolveOAuthContinueRedirect({
        destination: "/cuenta",
        profile: { displayName: "Ana Owner", phone: null },
      }),
    ).toBe("/cuenta/perfil?next=%2Fcuenta&required=1&missing=phone");
    expect(
      resolveOAuthContinueRedirect({
        destination: "/checkout",
        profile: {
          displayName: "Ana López",
          phone: "+54 280 412-3456",
        },
      }),
    ).toBe("/checkout");
  });
});
