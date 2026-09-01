import { defineConfig } from "@playwright/test";
import {
  E2E_DEFAULT_ORIGIN,
  assertSafeE2eTarget,
  e2eWebServerEnv,
  isLoopbackHostname,
} from "./e2e/lib/assert-safe-e2e-target";
import { E2E_VIEWPORTS } from "./e2e/lib/viewports";

const baseURL = process.env.E2E_BASE_URL?.trim() || E2E_DEFAULT_ORIGIN;
const target = assertSafeE2eTarget(baseURL, process.env);
const isLocalLoopback = isLoopbackHostname(target.hostname);
const ci = Boolean(process.env.CI);
const e2ePort = target.port || (target.protocol === "https:" ? "443" : "80");

/**
 * Chromium-only Playwright foundation.
 * Local Next is auto-started on loopback (default http://127.0.0.1:3100).
 * Firefox / WebKit are intentionally not configured.
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
        command: `npx next dev --hostname 127.0.0.1 --port ${e2ePort}`,
        url: target.origin,
        reuseExistingServer: ci ? false : true,
        timeout: 180_000,
        stdout: "pipe",
        stderr: "pipe",
        env: e2eWebServerEnv(process.env, target.origin),
      }
    : undefined,
});
