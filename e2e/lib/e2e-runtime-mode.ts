import type { EnvLike } from "../../src/application/checkout/real-order-lifecycle-guards";
import { e2eWebServerEnv } from "./assert-safe-e2e-target";
import {
  assertE2eDevWriteAllowed,
  E2E_WRITE_DEV_MODE,
} from "./dev-write-guard";

export const E2E_READ_ONLY_MODE = "READ_ONLY";
export type E2eRuntimeMode =
  | typeof E2E_READ_ONLY_MODE
  | typeof E2E_WRITE_DEV_MODE;

export function resolveE2eRuntimeMode(env: EnvLike): E2eRuntimeMode {
  const raw = env.E2E_MODE?.trim();
  if (!raw || raw === E2E_READ_ONLY_MODE) {
    return E2E_READ_ONLY_MODE;
  }
  if (raw === E2E_WRITE_DEV_MODE) {
    return E2E_WRITE_DEV_MODE;
  }
  throw new Error(
    `E2E mode guard: unsupported E2E_MODE. Use ${E2E_READ_ONLY_MODE} or ${E2E_WRITE_DEV_MODE}.`,
  );
}

function copyDefinedEnv(source: EnvLike): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  return env;
}

/**
 * Resolves the environment passed to the Playwright-started Next server.
 *
 * READ_ONLY preserves the original behavior: DB/admin credentials are removed.
 * WRITE_DEV performs the full preflight first, then and only then returns an
 * environment that may contain DEV credentials. Playwright config evaluates
 * this function before the webServer process is started.
 */
export function resolveE2eWebServerRuntime(input: {
  source: EnvLike;
  appBaseUrl: string;
}): { mode: E2eRuntimeMode; env: Record<string, string> } {
  const mode = resolveE2eRuntimeMode(input.source);

  if (mode === E2E_READ_ONLY_MODE) {
    return {
      mode,
      env: e2eWebServerEnv(input.source, input.appBaseUrl),
    };
  }

  assertE2eDevWriteAllowed({
    env: input.source,
    appBaseUrl: input.appBaseUrl,
  });

  const env = copyDefinedEnv(input.source);
  env.APP_BASE_URL = input.appBaseUrl;
  env.E2E_RUNNING = "1";
  env.E2E_MODE = E2E_WRITE_DEV_MODE;

  return { mode, env };
}
