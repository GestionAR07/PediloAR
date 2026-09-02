import {
  assertDevEnvironmentIdentity,
  type EnvLike,
} from "../../src/application/checkout/real-order-lifecycle-guards";
import { isLoopbackHostname } from "./assert-safe-e2e-target";

export const E2E_WRITE_DEV_MODE = "WRITE_DEV";
export const E2E_DEV_WRITE_SENTINEL = "I_ACCEPT_E2E_DEV_WRITES";

export const E2E_DEV_WRITE_ABORT = {
  mode: "E2E WRITE_DEV guard: E2E_MODE must be WRITE_DEV.",
  sentinel:
    "E2E WRITE_DEV guard: missing explicit E2E_ALLOW_WRITES confirmation.",
  appBase:
    "E2E WRITE_DEV guard: write-capable browser tests require a loopback app target.",
} as const;

function assertLoopbackAppBase(appBaseUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(appBaseUrl);
  } catch {
    throw new Error(E2E_DEV_WRITE_ABORT.appBase);
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    !isLoopbackHostname(parsed.hostname)
  ) {
    throw new Error(E2E_DEV_WRITE_ABORT.appBase);
  }
}

/**
 * Explicit authorization gate for browser E2E that may mutate DEV data.
 *
 * This is deliberately stricter than the READ_ONLY target guard:
 * - E2E_MODE must explicitly be WRITE_DEV;
 * - a second write sentinel must match exactly;
 * - the browser app must run on loopback (remote WRITE_DEV is forbidden);
 * - the shared DEV identity proof must verify APP_BASE_URL, Supabase project
 *   ref, DATABASE_URL identity where derivable, and non-production env.
 *
 * It never logs credentials or project refs.
 */
export function assertE2eDevWriteAllowed(input: {
  env: EnvLike;
  appBaseUrl: string;
}): void {
  const { env, appBaseUrl } = input;

  if (env.E2E_MODE !== E2E_WRITE_DEV_MODE) {
    throw new Error(E2E_DEV_WRITE_ABORT.mode);
  }

  if (env.E2E_ALLOW_WRITES !== E2E_DEV_WRITE_SENTINEL) {
    throw new Error(E2E_DEV_WRITE_ABORT.sentinel);
  }

  assertLoopbackAppBase(appBaseUrl);

  const identity = assertDevEnvironmentIdentity({
    ...env,
    APP_BASE_URL: appBaseUrl,
  });
  if (!identity.ok) {
    throw new Error(`E2E WRITE_DEV guard: ${identity.message}`);
  }
}
