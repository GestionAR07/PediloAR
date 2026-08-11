import { describe, expect, it } from "vitest";
import { isSafeInternalPath, sanitizeInternalPath } from "./safe-redirect";

describe("safe internal redirects", () => {
  it("accepts relative paths", () => {
    expect(sanitizeInternalPath("/admin")).toBe("/admin");
    expect(sanitizeInternalPath("/merchant/abc")).toBe("/merchant/abc");
    expect(isSafeInternalPath("/set-password")).toBe(true);
  });

  it("rejects open redirects", () => {
    expect(sanitizeInternalPath("https://evil.example", "/ok")).toBe("/ok");
    expect(sanitizeInternalPath("//evil.example", "/ok")).toBe("/ok");
    expect(sanitizeInternalPath("/\\evil", "/ok")).toBe("/ok");
    expect(sanitizeInternalPath("evil.com", "/ok")).toBe("/ok");
    expect(isSafeInternalPath("https://evil.example")).toBe(false);
    expect(isSafeInternalPath("//evil.example")).toBe(false);
  });

  it("preserves next for post-login flows", () => {
    expect(sanitizeInternalPath("/admin/merchants")).toBe("/admin/merchants");
  });
});
