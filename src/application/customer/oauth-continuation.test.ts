import { describe, expect, it } from "vitest";
import { resolveOAuthDestination } from "./oauth-continuation";

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
});
