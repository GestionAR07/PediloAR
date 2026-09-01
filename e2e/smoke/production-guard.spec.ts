import { expect, test } from "@playwright/test";
import {
  E2E_DEFAULT_ORIGIN,
  E2E_REMOTE_DEV_SENTINEL,
  assertSafeE2eTarget,
  e2eWebServerEnv,
  isBlockedProductionHost,
  isLoopbackHostname,
} from "../lib/assert-safe-e2e-target";

test.describe("production guard (fail-fast, no network writes)", () => {
  test("accepts the default loopback origin", () => {
    const url = assertSafeE2eTarget(E2E_DEFAULT_ORIGIN);
    expect(url.origin).toBe("http://127.0.0.1:3100");
  });

  test("accepts localhost", () => {
    expect(() => assertSafeE2eTarget("http://localhost:3100")).not.toThrow();
  });

  test("rejects missing and invalid URLs", () => {
    expect(() => assertSafeE2eTarget("")).toThrow(/missing target URL/);
    expect(() => assertSafeE2eTarget("not a url")).toThrow(
      /invalid target URL/,
    );
  });

  test("never allows pedilo.store, even with the remote-dev sentinel", () => {
    const env = { E2E_ALLOW_REMOTE_DEV: E2E_REMOTE_DEV_SENTINEL };
    expect(() => assertSafeE2eTarget("https://pedilo.store", env)).toThrow(
      /pedilo\.store/,
    );
    expect(() =>
      assertSafeE2eTarget("https://www.pedilo.store/login", env),
    ).toThrow(/pedilo\.store/);
    expect(() => assertSafeE2eTarget("https://app.pedilo.store", env)).toThrow(
      /pedilo\.store/,
    );
  });

  test("rejects a remote host unless the explicit sentinel is set", () => {
    expect(() => assertSafeE2eTarget("https://staging.example.com")).toThrow(
      /E2E_ALLOW_REMOTE_DEV/,
    );
  });

  test("allows a non-production remote host only with the sentinel", () => {
    const url = assertSafeE2eTarget("https://pedilo-dev.example.com", {
      E2E_ALLOW_REMOTE_DEV: E2E_REMOTE_DEV_SENTINEL,
    });
    expect(url.hostname).toBe("pedilo-dev.example.com");
  });

  test("does not treat E2E_ALLOW_REMOTE_DEV=true as authorization", () => {
    expect(() =>
      assertSafeE2eTarget("https://staging.example.com", {
        E2E_ALLOW_REMOTE_DEV: "true",
      }),
    ).toThrow(/E2E_ALLOW_REMOTE_DEV/);
  });

  test("recognizes loopback and production hosts", () => {
    expect(isLoopbackHostname("127.0.0.1")).toBe(true);
    expect(isLoopbackHostname("localhost")).toBe(true);
    expect(isLoopbackHostname("::1")).toBe(true);
    expect(isLoopbackHostname("10.0.0.1")).toBe(false);
    expect(isBlockedProductionHost("pedilo.store")).toBe(true);
    expect(isBlockedProductionHost("www.pedilo.store")).toBe(true);
    expect(isBlockedProductionHost("api.pedilo.store")).toBe(true);
    expect(isBlockedProductionHost("127.0.0.1")).toBe(false);
  });

  test("autostart env clears write secrets and forces local APP_BASE_URL", () => {
    const env = e2eWebServerEnv(
      {
        PATH: "/usr/bin",
        DATABASE_URL: "postgresql://prod.example/db",
        SUPABASE_SECRET_KEY: "secret",
        APP_BASE_URL: "https://pedilo.store",
      },
      E2E_DEFAULT_ORIGIN,
    );
    expect(env.APP_BASE_URL).toBe(E2E_DEFAULT_ORIGIN);
    expect(env.DATABASE_URL).toBe("");
    expect(env.SUPABASE_SECRET_KEY).toBe("");
    expect(env.E2E_RUNNING).toBe("1");
    expect(env.PATH).toBe("/usr/bin");
  });
});
