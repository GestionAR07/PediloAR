"use strict";

/* eslint-disable @typescript-eslint/no-require-imports -- CJS E2E launcher */

const { existsSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

// Safety order is deliberate:
// 1. capture per-run write confirmation from the operator shell;
// 2. load ordinary DEV identity/credentials from .env.local;
// 3. do NOT allow .env.local to persistently authorize writes;
// 4. set WRITE_DEV mode and let Playwright config run the fail-closed preflight;
// 5. only after that preflight can Playwright start Next with DEV credentials.
const explicitWriteConfirmation = process.env.E2E_ALLOW_WRITES;
const envPath = path.resolve(process.cwd(), ".env.local");

if (existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath);
  } catch {
    console.error(
      "E2E WRITE_DEV runner: could not load .env.local. Refusing to start.",
    );
    process.exit(1);
  }
}

if (explicitWriteConfirmation === undefined) {
  delete process.env.E2E_ALLOW_WRITES;
} else {
  process.env.E2E_ALLOW_WRITES = explicitWriteConfirmation;
}

// Invoke Playwright through Node instead of spawning `npx.cmd` directly.
// Node 24 on Windows can reject direct .cmd execution with spawnSync EINVAL.
// The CLI path is fixed inside this project's direct @playwright/test dependency,
// so no shell is involved and forwarded Playwright args are not shell-expanded.
const playwrightCli = path.resolve(
  process.cwd(),
  "node_modules",
  "@playwright",
  "test",
  "cli.js",
);

if (!existsSync(playwrightCli)) {
  console.error(
    "E2E WRITE_DEV runner: Playwright CLI is missing. Run npm ci first.",
  );
  process.exit(1);
}

const args = [playwrightCli, "test", ...process.argv.slice(2)];
const env = {
  ...process.env,
  E2E_MODE: "WRITE_DEV",
};

const result = spawnSync(process.execPath, args, {
  stdio: "inherit",
  env,
});

if (result.error) {
  console.error(
    `E2E WRITE_DEV runner failed to start: ${result.error.message}`,
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
