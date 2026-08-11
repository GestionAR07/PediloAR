import { describe, expect, it } from "vitest";
import { getAppBaseUrl, hasAppBaseUrl, appAbsoluteUrl } from "./app-base-url";

describe("APP_BASE_URL", () => {
  it("detects presence", () => {
    expect(hasAppBaseUrl({})).toBe(false);
    expect(hasAppBaseUrl({ APP_BASE_URL: "http://localhost:3001" })).toBe(true);
  });

  it("accepts http for local development", () => {
    const config = getAppBaseUrl({ APP_BASE_URL: "http://localhost:3001" });
    expect(config.baseUrl).toBe("http://localhost:3001");
    expect(config.isHttps).toBe(false);
  });

  it("accepts https", () => {
    const config = getAppBaseUrl({
      APP_BASE_URL: "https://app.example.com/",
    });
    expect(config.baseUrl).toBe("https://app.example.com");
    expect(config.isHttps).toBe(true);
  });

  it("rejects invalid schemes", () => {
    expect(() => getAppBaseUrl({ APP_BASE_URL: "ftp://localhost" })).toThrow(
      /http or https/,
    );
  });

  it("builds absolute URLs for internal paths", () => {
    const env = { APP_BASE_URL: "http://localhost:3001" };
    expect(appAbsoluteUrl("/auth/confirm", env)).toBe(
      "http://localhost:3001/auth/confirm",
    );
  });

  it("requires config", () => {
    expect(() => getAppBaseUrl({})).toThrow(/APP_BASE_URL/);
  });
});
