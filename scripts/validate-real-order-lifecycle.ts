/**
 * Controlled DEV-only smoke test against the real Postgres/Supabase database.
 *
 * Does NOT run from `npm test` or `npm run build`.
 * Requires an explicit confirm token and an exact MARKETPLACE_DEV_PROJECT_REF match.
 *
 * .env.local must include:
 *   MARKETPLACE_DEV_PROJECT_REF=<exact supabase project ref of the DEV project>
 *
 * Never logs DATABASE_URL, secret keys, tokens, or the project ref.
 *
 * PowerShell (from repo root):
 *   npx tsx --import ./scripts/stub-server-only.mjs scripts/validate-real-order-lifecycle.ts --confirm REAL_ORDER_LIFECYCLE_DEV
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertLifecycleHarnessGuards } from "@/application/checkout/real-order-lifecycle-guards";

function loadEnvLocalFile(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function main(): Promise<void> {
  try {
    loadEnvLocalFile();
    const guard = assertLifecycleHarnessGuards({
      argv: process.argv.slice(2),
      env: process.env,
    });
    if (!guard.ok) {
      console.error(guard.message);
      process.exitCode = 1;
      return;
    }

    const { runLifecycleAfterGuards } =
      await import("./validate-real-order-lifecycle-run");
    await runLifecycleAfterGuards();
  } catch (error) {
    if (error instanceof Error && error.name === "HarnessError") {
      console.error(error.message);
    } else if (error instanceof Error) {
      console.error(`[FAIL] ${error.message}`);
    } else {
      console.error("[FAIL] unknown harness error");
    }
    process.exitCode = 1;
  }
}

void main();
