"use strict";

/* eslint-disable @typescript-eslint/no-require-imports -- CJS E2E launcher */

const { spawnSync } = require("node:child_process");

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const args = ["playwright", "test", ...process.argv.slice(2)];
const env = {
  ...process.env,
  E2E_MODE: "WRITE_DEV",
};

const result = spawnSync(command, args, {
  stdio: "inherit",
  env,
});

if (result.error) {
  console.error(`E2E WRITE_DEV runner failed to start: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
