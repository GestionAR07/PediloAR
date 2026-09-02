import { describe, expect, it } from "vitest";
import {
  assertE2eDevWriteAllowed,
  E2E_DEV_WRITE_ABORT,
  E2E_DEV_WRITE_SENTINEL,
  E2E_WRITE_DEV_MODE,
} from "./dev-write-guard";
import {
  E2E_READ_ONLY_MODE,
  resolveE2eRuntimeMode,
  resolveE2eWebServerRuntime,
} from "./e2e-runtime-mode";

const DEV_REF = "abcdefghijklmnopabcd";
const OTHER_REF = "zzzzzzzzzzzzzzzzzzzz";
const APP_BASE_URL = "http://127.0.0.1:3100";

function allowedEnv(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    E2E_MODE: E2E_WRITE_DEV_MODE,
    E2E_ALLOW_WRITES: E2E_DEV_WRITE_SENTINEL,
    NODE_ENV: "development",
    MARKETPLACE_ENV: "development",
    MARKETPLACE_DEV_PROJECT_REF: DEV_REF,
    NEXT_PUBLIC_SUPABASE_URL: `https://${DEV_REF}.supabase.co`,
    DATABASE_URL: `postgresql://postgres.${DEV_REF}:secret@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`,
    SUPABASE_SECRET_KEY: "dev-secret-key",
    ...overrides,
  };
}

describe("assertE2eDevWriteAllowed", () => {
  it("passes only for explicit WRITE_DEV + sentinel + matching DEV identities", () => {
    expect(() =>
      assertE2eDevWriteAllowed({ env: allowedEnv(), appBaseUrl: APP_BASE_URL }),
    ).not.toThrow();
  });

  it("accepts a direct Supabase DATABASE_URL for the same DEV project", () => {
    expect(() =>
      assertE2eDevWriteAllowed({
        env: allowedEnv({
          DATABASE_URL: `postgresql://postgres:secret@db.${DEV_REF}.supabase.co:5432/postgres`,
        }),
        appBaseUrl: APP_BASE_URL,
      }),
    ).not.toThrow();
  });

  it("aborts when WRITE_DEV mode is not explicit", () => {
    expect(() =>
      assertE2eDevWriteAllowed({
        env: allowedEnv({ E2E_MODE: E2E_READ_ONLY_MODE }),
        appBaseUrl: APP_BASE_URL,
      }),
    ).toThrow(E2E_DEV_WRITE_ABORT.mode);
  });

  it("aborts when the write sentinel is missing or incorrect", () => {
    expect(() =>
      assertE2eDevWriteAllowed({
        env: allowedEnv({ E2E_ALLOW_WRITES: undefined }),
        appBaseUrl: APP_BASE_URL,
      }),
    ).toThrow(E2E_DEV_WRITE_ABORT.sentinel);
    expect(() =>
      assertE2eDevWriteAllowed({
        env: allowedEnv({ E2E_ALLOW_WRITES: "yes" }),
        appBaseUrl: APP_BASE_URL,
      }),
    ).toThrow(E2E_DEV_WRITE_ABORT.sentinel);
  });

  it("aborts a non-loopback app target including production", () => {
    expect(() =>
      assertE2eDevWriteAllowed({
        env: allowedEnv(),
        appBaseUrl: "https://pedilo.store",
      }),
    ).toThrow(E2E_DEV_WRITE_ABORT.appBase);
    expect(() =>
      assertE2eDevWriteAllowed({
        env: allowedEnv(),
        appBaseUrl: "https://dev.example.com",
      }),
    ).toThrow(E2E_DEV_WRITE_ABORT.appBase);
  });

  it("aborts production environment flags", () => {
    expect(() =>
      assertE2eDevWriteAllowed({
        env: allowedEnv({ NODE_ENV: "production" }),
        appBaseUrl: APP_BASE_URL,
      }),
    ).toThrow("entorno production");
  });

  it("aborts when the Supabase API project differs from the authorized DEV ref", () => {
    expect(() =>
      assertE2eDevWriteAllowed({
        env: allowedEnv({
          NEXT_PUBLIC_SUPABASE_URL: `https://${OTHER_REF}.supabase.co`,
        }),
        appBaseUrl: APP_BASE_URL,
      }),
    ).toThrow("no coincide");
  });

  it("aborts when DATABASE_URL cannot prove the same DEV project", () => {
    expect(() =>
      assertE2eDevWriteAllowed({
        env: allowedEnv({
          DATABASE_URL: "postgresql://user:secret@db.example.com:5432/postgres",
        }),
        appBaseUrl: APP_BASE_URL,
      }),
    ).toThrow(E2E_DEV_WRITE_ABORT.databaseIdentity);
  });

  it("aborts when the Supabase pooler username identifies another project", () => {
    expect(() =>
      assertE2eDevWriteAllowed({
        env: allowedEnv({
          DATABASE_URL: `postgresql://postgres.${OTHER_REF}:secret@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`,
        }),
        appBaseUrl: APP_BASE_URL,
      }),
    ).toThrow(E2E_DEV_WRITE_ABORT.databaseIdentity);
  });

  it("rejects lookalike pooler hostnames even with the correct DEV username", () => {
    expect(() =>
      assertE2eDevWriteAllowed({
        env: allowedEnv({
          DATABASE_URL: `postgresql://postgres.${DEV_REF}:secret@evilpooler.supabase.com:6543/postgres`,
        }),
        appBaseUrl: APP_BASE_URL,
      }),
    ).toThrow(E2E_DEV_WRITE_ABORT.databaseIdentity);
  });

  it("rejects non-Postgres URLs even on an actual Supabase pooler host", () => {
    expect(() =>
      assertE2eDevWriteAllowed({
        env: allowedEnv({
          DATABASE_URL: `https://postgres.${DEV_REF}:secret@aws-0-sa-east-1.pooler.supabase.com/postgres`,
        }),
        appBaseUrl: APP_BASE_URL,
      }),
    ).toThrow(E2E_DEV_WRITE_ABORT.databaseIdentity);
  });
});

describe("E2E runtime mode", () => {
  it("defaults to READ_ONLY and rejects unknown modes", () => {
    expect(resolveE2eRuntimeMode({})).toBe(E2E_READ_ONLY_MODE);
    expect(resolveE2eRuntimeMode({ E2E_MODE: E2E_READ_ONLY_MODE })).toBe(
      E2E_READ_ONLY_MODE,
    );
    expect(() => resolveE2eRuntimeMode({ E2E_MODE: "WRITE" })).toThrow(
      "unsupported E2E_MODE",
    );
  });

  it("READ_ONLY strips database/admin credentials", () => {
    const runtime = resolveE2eWebServerRuntime({
      source: {
        DATABASE_URL: "postgresql://do-not-pass",
        SUPABASE_SECRET_KEY: "do-not-pass",
      },
      appBaseUrl: APP_BASE_URL,
    });

    expect(runtime.mode).toBe(E2E_READ_ONLY_MODE);
    expect(runtime.env.DATABASE_URL).toBe("");
    expect(runtime.env.SUPABASE_SECRET_KEY).toBe("");
    expect(runtime.env.APP_BASE_URL).toBe(APP_BASE_URL);
    expect(runtime.env.E2E_RUNNING).toBe("1");
  });

  it("WRITE_DEV preserves DEV credentials only after preflight passes", () => {
    const source = allowedEnv();
    const runtime = resolveE2eWebServerRuntime({
      source,
      appBaseUrl: APP_BASE_URL,
    });

    expect(runtime.mode).toBe(E2E_WRITE_DEV_MODE);
    expect(runtime.env.DATABASE_URL).toBe(source.DATABASE_URL);
    expect(runtime.env.SUPABASE_SECRET_KEY).toBe(source.SUPABASE_SECRET_KEY);
    expect(runtime.env.E2E_MODE).toBe(E2E_WRITE_DEV_MODE);
    expect(runtime.env.E2E_RUNNING).toBe("1");
  });

  it("WRITE_DEV fails before returning any server environment when preflight fails", () => {
    expect(() =>
      resolveE2eWebServerRuntime({
        source: allowedEnv({ E2E_ALLOW_WRITES: undefined }),
        appBaseUrl: APP_BASE_URL,
      }),
    ).toThrow(E2E_DEV_WRITE_ABORT.sentinel);
  });
});
