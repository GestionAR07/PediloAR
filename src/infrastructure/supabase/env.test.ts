import { describe, expect, it } from "vitest";
import {
  getSupabasePublicConfig,
  getSupabaseSecretKey,
  hasSupabasePublicConfig,
  hasSupabaseSecretKey,
} from "./env";

describe("supabase public config", () => {
  it("reports absence without throwing", () => {
    expect(hasSupabasePublicConfig({})).toBe(false);
  });

  it("requires url and publishable key", () => {
    expect(() => getSupabasePublicConfig({})).toThrow(/Missing Supabase/);
    expect(() =>
      getSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toThrow(/Missing Supabase/);
  });

  it("accepts publishable pair", () => {
    const config = getSupabasePublicConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });
    expect(config.url).toContain("supabase.co");
    expect(config.publishableKey).toContain("publishable");
  });

  it("rejects service_role masquerading as public key", () => {
    expect(() =>
      getSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "service_role_secret",
      }),
    ).toThrow(/service-role/);
  });
});

describe("supabase secret key", () => {
  it("reads server-only secret", () => {
    expect(hasSupabaseSecretKey({})).toBe(false);
    expect(
      getSupabaseSecretKey({ SUPABASE_SECRET_KEY: "  secret-test  " }),
    ).toBe("secret-test");
  });

  it("forbids NEXT_PUBLIC_SUPABASE_SECRET_KEY", () => {
    expect(() =>
      getSupabaseSecretKey({
        SUPABASE_SECRET_KEY: "ok",
        NEXT_PUBLIC_SUPABASE_SECRET_KEY: "leaked",
      }),
    ).toThrow(/forbidden/);
  });

  it("throws when missing", () => {
    expect(() => getSupabaseSecretKey({})).toThrow(/SUPABASE_SECRET_KEY/);
  });
});
