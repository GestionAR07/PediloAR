import { describe, expect, it } from "vitest";
import {
  assertLifecycleHarnessGuards,
  extractSupabaseProjectRefFromApiUrl,
  extractSupabaseProjectRefFromDatabaseHostname,
  hasLifecycleConfirmToken,
  LIFECYCLE_HARNESS_ABORT,
  LIFECYCLE_HARNESS_CONFIRM_TOKEN,
} from "./real-order-lifecycle-guards";

const DEV_REF = "abcdefghijklmnopabcd";
const OTHER_REF = "zzzzzzzzzzzzzzzzzzzz";

const confirmArgv = ["--confirm", LIFECYCLE_HARNESS_CONFIRM_TOKEN] as const;

function allowedEnv(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    NODE_ENV: "development",
    APP_BASE_URL: "http://localhost:3001",
    MARKETPLACE_DEV_PROJECT_REF: DEV_REF,
    NEXT_PUBLIC_SUPABASE_URL: `https://${DEV_REF}.supabase.co`,
    DATABASE_URL: `postgresql://postgres.${DEV_REF}:secret@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`,
    ...overrides,
  };
}

function assertNoSecrets(message: string, extra: string[] = []): void {
  const forbidden = [
    DEV_REF,
    OTHER_REF,
    "postgresql://",
    "secret",
    "service_role",
    "eyJ",
    "DATABASE_URL=",
    "SUPABASE_URL=",
    "expected=",
    "actual=",
    ...extra,
  ];
  for (const token of forbidden) {
    expect(message).not.toContain(token);
  }
}

describe("extractSupabaseProjectRefFromApiUrl", () => {
  it("reads the ref from https://<project-ref>.supabase.co", () => {
    expect(
      extractSupabaseProjectRefFromApiUrl(`https://${DEV_REF}.supabase.co`),
    ).toBe(DEV_REF);
  });

  it("rejects malformed public URLs", () => {
    expect(extractSupabaseProjectRefFromApiUrl("")).toBeNull();
    expect(extractSupabaseProjectRefFromApiUrl("not-a-url")).toBeNull();
    expect(
      extractSupabaseProjectRefFromApiUrl(`http://${DEV_REF}.supabase.co`),
    ).toBeNull();
    expect(
      extractSupabaseProjectRefFromApiUrl("https://supabase.co"),
    ).toBeNull();
    expect(
      extractSupabaseProjectRefFromApiUrl(`https://${DEV_REF}.example.com`),
    ).toBeNull();
  });
});

describe("extractSupabaseProjectRefFromDatabaseHostname", () => {
  it("extracts db.<ref>.supabase.co and skips pooler hosts", () => {
    expect(
      extractSupabaseProjectRefFromDatabaseHostname(
        `db.${DEV_REF}.supabase.co`,
      ),
    ).toEqual({ kind: "ref", ref: DEV_REF });
    expect(
      extractSupabaseProjectRefFromDatabaseHostname(
        "aws-0-sa-east-1.pooler.supabase.com",
      ),
    ).toEqual({ kind: "skip" });
  });
});

describe("hasLifecycleConfirmToken", () => {
  it("accepts argv or env confirmation", () => {
    expect(hasLifecycleConfirmToken(confirmArgv, {})).toBe(true);
    expect(
      hasLifecycleConfirmToken([], {
        REAL_ORDER_LIFECYCLE_CONFIRM: LIFECYCLE_HARNESS_CONFIRM_TOKEN,
      }),
    ).toBe(true);
    expect(hasLifecycleConfirmToken(["--confirm", "nope"], {})).toBe(false);
  });
});

describe("assertLifecycleHarnessGuards", () => {
  it("aborts when MARKETPLACE_DEV_PROJECT_REF is missing", () => {
    const result = assertLifecycleHarnessGuards({
      argv: confirmArgv,
      env: allowedEnv({ MARKETPLACE_DEV_PROJECT_REF: "" }),
    });
    expect(result).toEqual({
      ok: false,
      message: LIFECYCLE_HARNESS_ABORT.missingDevRef,
    });
    if (!result.ok) assertNoSecrets(result.message);
  });

  it("aborts when the actual project ref does not match", () => {
    const result = assertLifecycleHarnessGuards({
      argv: confirmArgv,
      env: allowedEnv({
        NEXT_PUBLIC_SUPABASE_URL: `https://${OTHER_REF}.supabase.co`,
      }),
    });
    expect(result).toEqual({
      ok: false,
      message: LIFECYCLE_HARNESS_ABORT.mismatch,
    });
    if (!result.ok) assertNoSecrets(result.message);
  });

  it("passes on an exact project-ref match", () => {
    const result = assertLifecycleHarnessGuards({
      argv: confirmArgv,
      env: allowedEnv(),
    });
    expect(result).toEqual({ ok: true });
  });

  it("aborts production env even when the project ref matches", () => {
    const result = assertLifecycleHarnessGuards({
      argv: confirmArgv,
      env: allowedEnv({ NODE_ENV: "production" }),
    });
    expect(result).toEqual({
      ok: false,
      message: LIFECYCLE_HARNESS_ABORT.production,
    });
    if (!result.ok) assertNoSecrets(result.message);
  });

  it("aborts a remote APP_BASE_URL even when the project ref matches", () => {
    const result = assertLifecycleHarnessGuards({
      argv: confirmArgv,
      env: allowedEnv({ APP_BASE_URL: "https://marketplace.example.com" }),
    });
    expect(result).toEqual({
      ok: false,
      message: LIFECYCLE_HARNESS_ABORT.appBase,
    });
    if (!result.ok) assertNoSecrets(result.message);
  });

  it("aborts an incorrect confirm token", () => {
    const result = assertLifecycleHarnessGuards({
      argv: ["--confirm", "PLEASE_RUN"],
      env: allowedEnv(),
    });
    expect(result).toEqual({
      ok: false,
      message: LIFECYCLE_HARNESS_ABORT.confirm,
    });
    if (!result.ok) assertNoSecrets(result.message);
  });

  it("allows confirm token + matching DEV ref + localhost", () => {
    const result = assertLifecycleHarnessGuards({
      argv: confirmArgv,
      env: allowedEnv(),
    });
    expect(result.ok).toBe(true);
  });

  it("aborts a malformed NEXT_PUBLIC_SUPABASE_URL", () => {
    const result = assertLifecycleHarnessGuards({
      argv: confirmArgv,
      env: allowedEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://not-a-supabase-host.example",
      }),
    });
    expect(result).toEqual({
      ok: false,
      message: LIFECYCLE_HARNESS_ABORT.malformedSupabaseUrl,
    });
    if (!result.ok) {
      assertNoSecrets(result.message, ["not-a-supabase-host.example"]);
    }
  });

  it("never puts secrets or full refs in abort messages", () => {
    const cases = [
      assertLifecycleHarnessGuards({
        argv: [],
        env: allowedEnv(),
      }),
      assertLifecycleHarnessGuards({
        argv: confirmArgv,
        env: allowedEnv({ MARKETPLACE_DEV_PROJECT_REF: OTHER_REF }),
      }),
      assertLifecycleHarnessGuards({
        argv: confirmArgv,
        env: allowedEnv({
          NEXT_PUBLIC_SUPABASE_URL: "postgres://user:pass@host/db",
        }),
      }),
    ];
    for (const result of cases) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message.startsWith("[ABORT] ")).toBe(true);
        assertNoSecrets(result.message, [
          "user:pass",
          "postgres://",
          OTHER_REF,
        ]);
      }
    }
  });

  it("aborts when DATABASE_URL db host ref disagrees with the authorized DEV ref", () => {
    const result = assertLifecycleHarnessGuards({
      argv: confirmArgv,
      env: allowedEnv({
        DATABASE_URL: `postgresql://postgres:secret@db.${OTHER_REF}.supabase.co:5432/postgres`,
      }),
    });
    expect(result).toEqual({
      ok: false,
      message: LIFECYCLE_HARNESS_ABORT.mismatch,
    });
    if (!result.ok) assertNoSecrets(result.message);
  });
});
