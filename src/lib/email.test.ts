import { describe, expect, it } from "vitest";
import { isValidEmailFormat, normalizeEmail } from "./email";

describe("email helpers", () => {
  it("normalizes trim + lowercase", () => {
    expect(normalizeEmail("  Admin@Example.COM ")).toBe("admin@example.com");
  });

  it("validates basic format", () => {
    expect(isValidEmailFormat("a@b.co")).toBe(true);
    expect(isValidEmailFormat("not-an-email")).toBe(false);
    expect(isValidEmailFormat("")).toBe(false);
  });
});
