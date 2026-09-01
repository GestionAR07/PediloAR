import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  E2E_DEFAULT_ORIGIN,
  E2E_REMOTE_DEV_SENTINEL,
  assertSafeE2eTarget,
  assertSafeNavigatedUrl,
  e2eWebServerEnv,
  isBlockedProductionHost,
  isLoopbackHostname,
  normalizeHostname,
} from "../lib/assert-safe-e2e-target";
import {
  E2E_REUSE_EXISTING_SERVER,
  assertE2ePortFree,
} from "../lib/web-server-policy";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const authorizedRemote = {
  E2E_ALLOW_REMOTE_DEV: E2E_REMOTE_DEV_SENTINEL,
  E2E_REMOTE_DEV_HOST: "pedilo-dev.example.com",
};

test.describe("production guard (fail-fast, no network writes)", () => {
  test("accepts the default loopback origin", () => {
    const url = assertSafeE2eTarget(E2E_DEFAULT_ORIGIN);
    expect(url.origin).toBe("http://127.0.0.1:3100");
  });

  test("accepts localhost and localhost trailing-dot as loopback", () => {
    expect(() => assertSafeE2eTarget("http://localhost:3100")).not.toThrow();
    expect(() => assertSafeE2eTarget("http://localhost.:3100")).not.toThrow();
  });

  test("rejects missing and invalid URLs", () => {
    expect(() => assertSafeE2eTarget("")).toThrow(/missing target URL/);
    expect(() => assertSafeE2eTarget("not a url")).toThrow(
      /invalid target URL/,
    );
  });

  test("rejects pedilo.store trailing-dot FQDN", () => {
    expect(() => assertSafeE2eTarget("https://pedilo.store.")).toThrow(
      /pedilo\.store/,
    );
    expect(isBlockedProductionHost("pedilo.store.")).toBe(true);
    expect(normalizeHostname("pedilo.store.")).toBe("pedilo.store");
  });

  test("rejects subdomain trailing-dot FQDN", () => {
    expect(() => assertSafeE2eTarget("https://www.pedilo.store.")).toThrow(
      /pedilo\.store/,
    );
    expect(() => assertSafeE2eTarget("https://x.pedilo.store.")).toThrow(
      /pedilo\.store/,
    );
    expect(isBlockedProductionHost("www.pedilo.store.")).toBe(true);
    expect(isBlockedProductionHost("x.pedilo.store.")).toBe(true);
  });

  test("never allows pedilo.store even with all remote-dev flags", () => {
    const allFlags = {
      E2E_ALLOW_REMOTE_DEV: E2E_REMOTE_DEV_SENTINEL,
      E2E_REMOTE_DEV_HOST: "pedilo.store",
    };
    expect(() => assertSafeE2eTarget("https://pedilo.store", allFlags)).toThrow(
      /pedilo\.store/,
    );
    expect(() =>
      assertSafeE2eTarget("https://www.pedilo.store/login", allFlags),
    ).toThrow(/pedilo\.store/);
    expect(() =>
      assertSafeE2eTarget("https://app.pedilo.store", allFlags),
    ).toThrow(/pedilo\.store/);
    expect(() =>
      assertSafeE2eTarget("https://pedilo.store.", allFlags),
    ).toThrow(/pedilo\.store/);
    expect(() =>
      assertSafeE2eTarget("https://staging.example.com", {
        E2E_ALLOW_REMOTE_DEV: E2E_REMOTE_DEV_SENTINEL,
        E2E_REMOTE_DEV_HOST: "pedilo.store.",
      }),
    ).toThrow(/production|pedilo\.store/);
  });

  test("rejects a remote host without authorization", () => {
    expect(() => assertSafeE2eTarget("https://staging.example.com")).toThrow(
      /E2E_ALLOW_REMOTE_DEV/,
    );
  });

  test("rejects a remote host with sentinel but without explicit hostname", () => {
    expect(() =>
      assertSafeE2eTarget("https://staging.example.com", {
        E2E_ALLOW_REMOTE_DEV: E2E_REMOTE_DEV_SENTINEL,
      }),
    ).toThrow(/E2E_REMOTE_DEV_HOST/);
  });

  test("allows only the exact authorized remote host", () => {
    const url = assertSafeE2eTarget(
      "https://pedilo-dev.example.com",
      authorizedRemote,
    );
    expect(url.hostname).toBe("pedilo-dev.example.com");
    expect(() =>
      assertSafeE2eTarget("https://other.example.com", authorizedRemote),
    ).toThrow(/does not match E2E_REMOTE_DEV_HOST/);
  });

  test("does not treat E2E_ALLOW_REMOTE_DEV=true as authorization", () => {
    expect(() =>
      assertSafeE2eTarget("https://staging.example.com", {
        E2E_ALLOW_REMOTE_DEV: "true",
        E2E_REMOTE_DEV_HOST: "staging.example.com",
      }),
    ).toThrow(/E2E_ALLOW_REMOTE_DEV/);
  });

  test("recognizes loopback and production hosts", () => {
    expect(isLoopbackHostname("127.0.0.1")).toBe(true);
    expect(isLoopbackHostname("localhost")).toBe(true);
    expect(isLoopbackHostname("localhost.")).toBe(true);
    expect(isLoopbackHostname("::1")).toBe(true);
    expect(isLoopbackHostname("10.0.0.1")).toBe(false);
    expect(isBlockedProductionHost("pedilo.store")).toBe(true);
    expect(isBlockedProductionHost("www.pedilo.store")).toBe(true);
    expect(isBlockedProductionHost("api.pedilo.store")).toBe(true);
    expect(isBlockedProductionHost("127.0.0.1")).toBe(false);
  });

  test("navigation guard allows internals and loopback, rejects production URLs", () => {
    expect(() => assertSafeNavigatedUrl("about:blank")).not.toThrow();
    expect(() =>
      assertSafeNavigatedUrl("http://127.0.0.1:3100/login"),
    ).not.toThrow();
    expect(() => assertSafeNavigatedUrl("https://pedilo.store/")).toThrow(
      /pedilo\.store/,
    );
    expect(() =>
      assertSafeNavigatedUrl("https://www.pedilo.store./checkout"),
    ).toThrow(/pedilo\.store/);
    expect(() => assertSafeNavigatedUrl("https://staging.example.com")).toThrow(
      /E2E_ALLOW_REMOTE_DEV/,
    );
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

test.describe("webServer reuse policy", () => {
  test("Playwright is configured to never reuse an existing server", () => {
    expect(E2E_REUSE_EXISTING_SERVER).toBe(false);
    const config = read("playwright.config.ts");
    expect(config).toContain("reuseExistingServer: E2E_REUSE_EXISTING_SERVER");
    expect(config).not.toMatch(/reuseExistingServer:\s*true/);
    expect(config).not.toMatch(/reuseExistingServer:\s*!process\.env\.CI/);
    expect(config).not.toMatch(/reuseExistingServer:\s*ci \? false : true/);
    expect(config).toContain("e2e/lib/start-e2e-next.cjs");
  });

  test("fails fast when a listen port is already occupied (owned server, not killed)", async () => {
    const server = net.createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new Error("test server did not bind a TCP port");
    }
    try {
      expect(() => assertE2ePortFree(address.port, "127.0.0.1")).toThrow(
        /already occupied/,
      );
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});

test.describe("fixture inheritance", () => {
  test("browser specs import the centralized navigation-guard fixtures", () => {
    const dir = path.join(root, "e2e", "smoke");
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".spec.ts")) {
        continue;
      }
      const text = fs.readFileSync(path.join(dir, file), "utf8");
      const usesPage =
        /\{\s*page\s*\}/.test(text) ||
        /\{\s*page,/.test(text) ||
        /page\.goto\(/.test(text);
      if (!usesPage) {
        continue;
      }
      expect(text, file).toContain('from "../fixtures"');
      expect(text, file).not.toMatch(
        /import \{[^}]*\btest\b[^}]*\} from "@playwright\/test"/,
      );
    }
  });
});
