/**
 * Production / remote-target guard for Pedilo E2E.
 *
 * Default: only loopback (127.0.0.1 / localhost / ::1).
 * Remote DEV: requires the explicit sentinel E2E_ALLOW_REMOTE_DEV.
 * Production (pedilo.store) is never allowed, even with the sentinel.
 */

export const E2E_DEFAULT_ORIGIN = "http://127.0.0.1:3100";
export const E2E_DEFAULT_PORT = 3100;
export const E2E_REMOTE_DEV_SENTINEL = "I_ACCEPT_REMOTE_DEV";

export type E2eGuardEnv = Readonly<Record<string, string | undefined>>;

const PRODUCTION_HOSTS = new Set(["pedilo.store", "www.pedilo.store"]);

export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

export function isBlockedProductionHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (PRODUCTION_HOSTS.has(host)) {
    return true;
  }
  return host.endsWith(".pedilo.store");
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

  const hostname = parsed.hostname;

  if (isBlockedProductionHost(hostname)) {
    throw new Error(
      `E2E production guard: refusing to run against ${hostname}. Never use pedilo.store. Point E2E at a local instance (${E2E_DEFAULT_ORIGIN}).`,
    );
  }

  if (!isLoopbackHostname(hostname)) {
    const allowed = env.E2E_ALLOW_REMOTE_DEV === E2E_REMOTE_DEV_SENTINEL;
    if (!allowed) {
      throw new Error(
        `E2E production guard: ${hostname} is not loopback. Default E2E only accepts localhost / 127.0.0.1. A remote DEV environment requires E2E_ALLOW_REMOTE_DEV=${E2E_REMOTE_DEV_SENTINEL}. Production (pedilo.store) is never allowed.`,
      );
    }
  }

  return parsed;
}

/**
 * Env for the Playwright-started Next process.
 * Strips write-capable secrets so the autostarted server cannot mutate
 * production (or any) database / Auth Admin API.
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
