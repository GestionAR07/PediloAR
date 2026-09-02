import {
  assertDevEnvironmentIdentity,
  extractSupabaseProjectRefFromApiUrl,
  extractSupabaseProjectRefFromDatabaseHostname,
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
  databaseIdentity:
    "E2E WRITE_DEV guard: DATABASE_URL cannot be proven to belong to the authorized DEV Supabase project.",
} as const;

const SUPABASE_POOLER_HOST_PATTERN = /(^|\.)pooler\.supabase\.com$/i;

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

function deriveDatabaseProjectRef(databaseUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    return null;
  }

  const hostnameIdentity = extractSupabaseProjectRefFromDatabaseHostname(
    parsed.hostname,
  );
  if (hostnameIdentity.kind === "ref") {
    return hostnameIdentity.ref;
  }

  // Supabase transaction/session poolers identify the project in the username
  // (`postgres.<project-ref>`). Only an actual *.pooler.supabase.com host is
  // accepted; lookalike or generic hosts fail closed.
  if (SUPABASE_POOLER_HOST_PATTERN.test(parsed.hostname)) {
    const username = decodeURIComponent(parsed.username);
    const match = /^postgres\.([a-z0-9]{8,64})$/i.exec(username);
    return match?.[1]?.toLowerCase() ?? null;
  }

  return null;
}

function assertDatabaseMatchesAuthorizedDev(env: EnvLike): void {
  const apiRef = extractSupabaseProjectRefFromApiUrl(
    env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  );
  const databaseRef = deriveDatabaseProjectRef(env.DATABASE_URL ?? "");

  if (!apiRef || !databaseRef || apiRef !== databaseRef) {
    throw new Error(E2E_DEV_WRITE_ABORT.databaseIdentity);
  }
}

/**
 * Explicit authorization gate for browser E2E that may mutate DEV data.
 *
 * This is deliberately stricter than the READ_ONLY target guard:
 * - E2E_MODE must explicitly be WRITE_DEV;
 * - a second write sentinel must match exactly;
 * - the browser app must run on loopback (remote WRITE_DEV is forbidden);
 * - the shared DEV identity proof verifies APP_BASE_URL, the authorized
 *   Supabase project ref, DATABASE_URL basics, and non-production env;
 * - WRITE_DEV additionally requires DATABASE_URL's project identity to be
 *   derivable and to exactly match the authorized Supabase API project.
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

  assertDatabaseMatchesAuthorizedDev(env);
}
