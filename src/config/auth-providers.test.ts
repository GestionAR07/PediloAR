import { describe, expect, it } from "vitest";
import { isGoogleOAuthEnabled } from "./auth-providers";

describe("auth provider feature switches", () => {
  it("keeps Google hidden unless explicitly enabled", () => {
    expect(isGoogleOAuthEnabled({})).toBe(false);
    expect(
      isGoogleOAuthEnabled({ NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "false" }),
    ).toBe(false);
  });

  it("accepts an explicit case-insensitive true value", () => {
    expect(
      isGoogleOAuthEnabled({ NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: " TRUE " }),
    ).toBe(true);
  });
});
