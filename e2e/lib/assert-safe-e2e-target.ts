/**
 * Production / remote-target guard for Pedilo E2E.
 *
 * Default: only loopback (127.0.0.1 / localhost / ::1).
 * Remote DEV requires BOTH:
 *   E2E_ALLOW_REMOTE_DEV=I_ACCEPT_REMOTE_DEV
 *   E2E_REMOTE_DEV_HOST=<exact hostname>
 * Production (pedilo.store and subdomains, including trailing-dot FQDNs)
 * is never allowed, even with those flags.
 */

export const E2E_DEFAULT_ORIGIN = "http://127.0.0.1:3100";
export const E2E_DEFAULT_PORT = 3100;
export const E2E_REMOTE_DEV_SENTINEL = "I_ACCEPT_REMOTE_DEV";

export type E2eGuardEnv = Readonly<Record<string, string | undefined>>;

const PRODUCTION_APEX = "pedilo.store";

export function normalizeHostname(hostname: string): string {
  let host = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  while (host.endsWith(".")) {
    host = host.slice(0, -1);
  }
  return host;
}

export function isLoopbackHostname(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

export function isBlockedProductionHost(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (!host) {
    return false;
  }
  if (host === PRODUCTION_APEX || host === `www.${PRODUCTION_APEX}`) {
    return true;
  }
  return host.endsWith(`.${PRODUCTION_APEX}`);
}

function assertRemoteDevAuthorized(hostname: string, env: E2eGuardEnv): void {
  const sentinelOk = env.E2E_ALLOW_REMOTE_DEV === E2E_REMOTE_DEV_SENTINEL;
  const allowedHost = normalizeHostname(env.E2E_REMOTE_DEV_HOST ?? "");

  if (!sentinelOk) {
    throw new Error(
      `E2E production guard: ${hostname} is not loopback. Default E2E only accepts localhost / 127.0.0.1. A remote DEV environment requires E2E_ALLOW_REMOTE_DEV=${E2E_REMOTE_DEV_SENTINEL} AND E2E_REMOTE_DEV_HOST=<exact hostname>. Production (pedilo.store) is never allowed.`,
    );
  }

  if (!allowedHost) {
    throw new Error(
      `E2E production guard: E2E_ALLOW_REMOTE_DEV is set but E2E_REMOTE_DEV_HOST is missing. The sentinel alone does not authorize any remote host. Set E2E_REMOTE_DEV_HOST to the exact DEV hostname. Production (pedilo.store) is never allowed.`,
    );
  }

  if (isBlockedProductionHost(allowedHost)) {
    throw new Error(
      `E2E production guard: E2E_REMOTE_DEV_HOST=${allowedHost} is production. pedilo.store is never allowed.`,
    );
  }

  if (hostname !== allowedHost) {
    throw new Error(
      `E2E production guard: ${hostname} does not match E2E_REMOTE_DEV_HOST=${allowedHost}. Remote DEV allows only that exact hostname.`,
    );
  }
}

export function assertSafeE2eTarget(
  baseURL: string,
  env: E2eGuardEnv = process.env,
): URL {
  const trimmed = baseURL?.trim() ?? "";
  if (!trimmed) {
    throw new Error(
      "E2E production guard: missing target URL. Default is http://127.0.0.1:3100. Refusing to start.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(
      `E2E production guard: invalid target URL (${trimmed}). Refusing to start.`,
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `E2E production guard: refusing non-http(s) target (${parsed.protocol}).`,
    );
  }

  const hostname = normalizeHostname(parsed.hostname);

  if (isBlockedProductionHost(hostname)) {
    throw new Error(
      `E2E production guard: refusing to run against ${parsed.hostname}. Never use pedilo.store. Point E2E at a local instance (${E2E_DEFAULT_ORIGIN}).`,
    );
  }

  if (!isLoopbackHostname(hostname)) {
    assertRemoteDevAuthorized(hostname, env);
  }

  return parsed;
}

const INTERNAL_PROTOCOLS = new Set([
  "about:",
  "blob:",
  "chrome:",
  "chrome-error:",
  "data:",
  "playwright:",
]);

/**
 * Guard for every navigated URL (main-frame HTTP(S) must pass).
 * Internals such as about:blank are allowed during bootstrap.
 */
export function assertSafeNavigatedUrl(
  urlString: string,
  env: E2eGuardEnv = process.env,
): void {
  if (!urlString) {
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error(
      `E2E navigation guard: invalid URL (${urlString}). Refusing to continue.`,
    );
  }

  if (INTERNAL_PROTOCOLS.has(parsed.protocol)) {
    return;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return;
  }

  assertSafeE2eTarget(urlString, env);
}

/**
 * Env for the Playwright-started Next process.
 * Strips write-capable secrets so the autostarted server cannot mutate
 * production (or any) database / Auth Admin API.
 *
 * CURRENT_E2E_MODE = READ_ONLY. Clearing these secrets is not a write
 * authorization gate for future submit tests.
 */
export function e2eWebServerEnv(
  source: E2eGuardEnv = process.env,
  appBaseUrl: string = E2E_DEFAULT_ORIGIN,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) {
      continue;
    }
    env[key] = value;
  }

  env.APP_BASE_URL = appBaseUrl;
  env.DATABASE_URL = "";
  env.SUPABASE_SECRET_KEY = "";
  env.E2E_RUNNING = "1";
  return env;
}
