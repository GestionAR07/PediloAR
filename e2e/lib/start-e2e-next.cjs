"use strict";

/* eslint-disable @typescript-eslint/no-require-imports -- CJS webServer launcher */

/**
 * Starts the E2E Next server after failing fast if the listen port is taken.
 * Invoked only by Playwright webServer — not by test workers reloading config.
 */
const { spawn, spawnSync } = require("node:child_process");

const host = "127.0.0.1";
const port = Number(process.argv[2]);

if (!Number.isInteger(port) || port <= 0) {
  console.error(
    "E2E fail-fast: missing or invalid listen port for the autostarted Next server.",
  );
  process.exit(1);
}

function probeTcpPortOccupied() {
  const script = `
    const net = require("net");
    const socket = net.connect(${JSON.stringify({ host, port })});
    socket.setTimeout(400);
    socket.once("connect", () => {
      socket.destroy();
      process.exit(0);
    });
    socket.once("timeout", () => {
      socket.destroy();
      process.exit(1);
    });
    socket.once("error", () => {
      process.exit(1);
    });
  `;
  const result = spawnSync(process.execPath, ["-e", script], {
    encoding: "utf8",
    timeout: 2000,
  });
  return result.status === 0;
}

if (probeTcpPortOccupied()) {
  console.error(
    `E2E fail-fast: ${host}:${port} is already occupied. ` +
      "npm run e2e always starts its own Next for the current HEAD " +
      "(reuseExistingServer=false). Stop the other process and retry. " +
      "Playwright will not kill it or reuse it.",
  );
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [
    require.resolve("next/dist/bin/next"),
    "dev",
    "--hostname",
    host,
    "--port",
    String(port),
  ],
  { stdio: "inherit", env: process.env },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
