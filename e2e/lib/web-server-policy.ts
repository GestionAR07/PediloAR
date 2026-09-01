import { spawnSync } from "node:child_process";

/**
 * Always start a fresh Next for the current HEAD.
 * Reusing a server can test the wrong commit, env, or credentials.
 */
export const E2E_REUSE_EXISTING_SERVER = false;

export function probeTcpPortOccupied(port: number, host: string): boolean {
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

/**
 * Fail fast when the E2E listen port is already taken.
 * Does not kill the occupying process.
 */
export function assertE2ePortFree(port: number, host: string): void {
  if (!probeTcpPortOccupied(port, host)) {
    return;
  }

  throw new Error(
    `E2E fail-fast: ${host}:${port} is already occupied. ` +
      `npm run e2e always starts its own Next for the current HEAD ` +
      `(reuseExistingServer=${String(E2E_REUSE_EXISTING_SERVER)}). ` +
      `Stop the other process and retry. Playwright will not kill it or reuse it.`,
  );
}
