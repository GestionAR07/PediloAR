/**
 * Pre-write safety gates for real DEV-only mutation harnesses.
 * Pure: no database I/O, no secret logging, no project-ref echo.
 */

export type EnvLike = Readonly<Record<string, string | undefined>>;

export const LIFECYCLE_HARNESS_CONFIRM_TOKEN = "REAL_ORDER_LIFECYCLE_DEV";

export const LIFECYCLE_HARNESS_ABORT = {
  confirm: "[ABORT] Falta confirmación explícita.",
  production:
    "[ABORT] El harness no puede ejecutarse contra un entorno production.",
  appBase: "[ABORT] APP_BASE_URL debe ser localhost para este harness.",
  missingDevRef: "[ABORT] MARKETPLACE_DEV_PROJECT_REF no está configurado.",
  mismatch:
    "[ABORT] El proyecto Supabase configurado no coincide con el proyecto DEV autorizado.",
  malformedSupabaseUrl:
    "[ABORT] NEXT_PUBLIC_SUPABASE_URL no tiene la forma esperada para identificar el proyecto DEV.",
  missingDatabaseUrl: "[ABORT] DATABASE_URL no está configurado.",
  unreadableDatabaseUrl: "[ABORT] DATABASE_URL no tiene un host interpretable.",
} as const;

export type LifecycleHarnessGuardResult =
  { ok: true } | { ok: false; message: string };

const PROJECT_REF_PATTERN = /^[a-z0-9]{8,64}$/;
const API_HOST_PATTERN = /^([a-z0-9]{8,64})\.supabase\.co$/i;
const DB_HOST_PATTERN = /^db\.([a-z0-9]{8,64})\.supabase\.co$/i;
const POOLER_HOST_PATTERN = /(^|\.)pooler\.supabase\.com$/i;

function abort(
  message: (typeof LIFECYCLE_HARNESS_ABORT)[keyof typeof LIFECYCLE_HARNESS_ABORT],
): LifecycleHarnessGuardResult {
  return { ok: false, message };
}

export function hasLifecycleConfirmToken(
  argv: readonly string[],
  env: EnvLike = {},
): boolean {
  if (env.REAL_ORDER_LIFECYCLE_CONFIRM === LIFECYCLE_HARNESS_CONFIRM_TOKEN) {
    return true;
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === `--confirm=${LIFECYCLE_HARNESS_CONFIRM_TOKEN}`) {
      return true;
    }
    if (
      arg === "--confirm" &&
      argv[index + 1] === LIFECYCLE_HARNESS_CONFIRM_TOKEN
    ) {
      return true;
    }
  }
  return false;
}

function hostnameFromUrl(raw: string): string | null {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostLooksLikeProduction(hostname: string): boolean {
  return hostname
    .split(".")
    .some((label) => label === "prod" || label === "production");
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function normalizeProjectRef(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!PROJECT_REF_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * Derives the Supabase project ref from the public API URL.
 * Expected: https://<project-ref>.supabase.co
 */
export function extractSupabaseProjectRefFromApiUrl(
  supabaseUrl: string,
): string | null {
  const trimmed = supabaseUrl.trim();
  if (!trimmed) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") {
    return null;
  }
  const match = API_HOST_PATTERN.exec(parsed.hostname);
  if (!match?.[1]) {
    return null;
  }
  return match[1].toLowerCase();
}

/**
 * Extracts a project ref from DATABASE_URL only when the hostname is
 * unambiguously `db.<ref>.supabase.co`. Pooler hosts are skipped.
 */
export function extractSupabaseProjectRefFromDatabaseHostname(
  hostname: string,
): { kind: "ref"; ref: string } | { kind: "skip" } | { kind: "unknown" } {
  const host = hostname.toLowerCase();
  const dbMatch = DB_HOST_PATTERN.exec(host);
  if (dbMatch?.[1]) {
    return { kind: "ref", ref: dbMatch[1].toLowerCase() };
  }
  if (POOLER_HOST_PATTERN.test(host) || isLocalHostname(host)) {
    return { kind: "skip" };
  }
  return { kind: "unknown" };
}

/**
 * Shared DEV-environment identity proof for any mutation harness.
 * It deliberately does not authorize writes by itself: each caller must
 * require its own explicit confirmation token before calling this function.
 */
export function assertDevEnvironmentIdentity(
  env: EnvLike,
): LifecycleHarnessGuardResult {
  if (
    env.NODE_ENV === "production" ||
    env.VERCEL_ENV === "production" ||
    env.MARKETPLACE_ENV === "production"
  ) {
    return abort(LIFECYCLE_HARNESS_ABORT.production);
  }

  const appBase = env.APP_BASE_URL?.trim() ?? "";
  if (!appBase) {
    return abort(LIFECYCLE_HARNESS_ABORT.appBase);
  }
  const appHost = hostnameFromUrl(appBase);
  if (!appHost || !isLocalHostname(appHost)) {
    return abort(LIFECYCLE_HARNESS_ABORT.appBase);
  }

  const expectedRef = normalizeProjectRef(
    env.MARKETPLACE_DEV_PROJECT_REF ?? "",
  );
  if (!expectedRef) {
    return abort(LIFECYCLE_HARNESS_ABORT.missingDevRef);
  }

  const actualRef = extractSupabaseProjectRefFromApiUrl(
    env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  );
  if (!actualRef) {
    return abort(LIFECYCLE_HARNESS_ABORT.malformedSupabaseUrl);
  }
  if (actualRef !== expectedRef) {
    return abort(LIFECYCLE_HARNESS_ABORT.mismatch);
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const supabaseHost = hostnameFromUrl(supabaseUrl);
  if (supabaseHost && hostLooksLikeProduction(supabaseHost)) {
    return abort(LIFECYCLE_HARNESS_ABORT.production);
  }

  const databaseUrl = env.DATABASE_URL?.trim() ?? "";
  if (!databaseUrl) {
    return abort(LIFECYCLE_HARNESS_ABORT.missingDatabaseUrl);
  }
  const dbHost = hostnameFromUrl(databaseUrl);
  if (!dbHost) {
    return abort(LIFECYCLE_HARNESS_ABORT.unreadableDatabaseUrl);
  }
  if (hostLooksLikeProduction(dbHost)) {
    return abort(LIFECYCLE_HARNESS_ABORT.production);
  }

  const fromDatabase = extractSupabaseProjectRefFromDatabaseHostname(dbHost);
  if (fromDatabase.kind === "ref" && fromDatabase.ref !== expectedRef) {
    return abort(LIFECYCLE_HARNESS_ABORT.mismatch);
  }

  return { ok: true };
}

export function assertLifecycleHarnessGuards(input: {
  argv: readonly string[];
  env: EnvLike;
}): LifecycleHarnessGuardResult {
  const { argv, env } = input;

  if (!hasLifecycleConfirmToken(argv, env)) {
    return abort(LIFECYCLE_HARNESS_ABORT.confirm);
  }

  return assertDevEnvironmentIdentity(env);
}
