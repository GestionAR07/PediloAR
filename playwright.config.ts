import { defineConfig } from "@playwright/test";
import {
  E2E_DEFAULT_ORIGIN,
  assertSafeE2eTarget,
  e2eWebServerEnv,
  isLoopbackHostname,
} from "./e2e/lib/assert-safe-e2e-target";
import { E2E_VIEWPORTS } from "./e2e/lib/viewports";
import { E2E_REUSE_EXISTING_SERVER } from "./e2e/lib/web-server-policy";

const baseURL = process.env.E2E_BASE_URL?.trim() || E2E_DEFAULT_ORIGIN;
const target = assertSafeE2eTarget(baseURL, process.env);
const isLocalLoopback = isLoopbackHostname(target.hostname);
const ci = Boolean(process.env.CI);
const e2ePort = Number(
  target.port || (target.protocol === "https:" ? "443" : "80"),
);

/**
 * Chromium-only Playwright foundation.
 * Always auto-starts Next on loopback (default http://127.0.0.1:3100).
 * Never reuses an existing server. Firefox / WebKit are not configured.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  outputDir: "test-results",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: target.origin,
    viewport: E2E_VIEWPORTS.desktop,
    locale: "es-AR",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: isLocalLoopback
    ? {
        command: `node e2e/lib/start-e2e-next.cjs ${e2ePort}`,
        url: target.origin,
        reuseExistingServer: E2E_REUSE_EXISTING_SERVER,
        timeout: 180_000,
        stdout: "pipe",
        stderr: "pipe",
        env: e2eWebServerEnv(process.env, target.origin),
      }
    : undefined,
});
