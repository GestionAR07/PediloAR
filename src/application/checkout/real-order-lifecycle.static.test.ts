import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("real order lifecycle harness guards", () => {
  it("lives outside npm test and requires an explicit DEV confirm token", () => {
    const pkg = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.test).toBe("vitest run");
    expect(pkg.scripts.test).not.toContain("validate-real-order-lifecycle");
    expect(pkg.scripts.build).not.toContain("validate-real-order-lifecycle");
    expect(pkg.scripts["validate:real-order-lifecycle"]).toContain(
      "--conditions=react-server",
    );
    expect(pkg.scripts["validate:real-order-lifecycle"]).toContain(
      "--import tsx",
    );
    expect(pkg.scripts["validate:real-order-lifecycle"]).not.toContain(
      "stub-server-only",
    );
    expect(fs.existsSync(path.join(root, "scripts/stub-server-only.mjs"))).toBe(
      false,
    );

    const vitest = read("vitest.config.ts");
    expect(vitest).toContain('include: ["src/**/*.{test,spec}.{ts,tsx}"]');

    const entry = read("scripts/validate-real-order-lifecycle.ts");
    const run = read("scripts/validate-real-order-lifecycle-run.ts");
    const guards = read(
      "src/application/checkout/real-order-lifecycle-guards.ts",
    );

    expect(entry).toContain("loadEnvLocalFile");
    expect(entry).toContain("assertLifecycleHarnessGuards");
    expect(entry).toContain("await import(");
    expect(entry).toContain("validate-real-order-lifecycle-run");
    expect(entry).not.toContain('from "@/infrastructure/db/client"');
    expect(entry).not.toContain("getDb");

    expect(guards).toContain("MARKETPLACE_DEV_PROJECT_REF");
    expect(guards).toContain("extractSupabaseProjectRefFromApiUrl");
    expect(guards).toContain("Falta confirmación explícita");
    expect(guards).toContain("MARKETPLACE_DEV_PROJECT_REF no está configurado");
    expect(guards).not.toContain("expected=");
    expect(guards).not.toContain("actual=");
    expect(guards).not.toContain("getSupabaseSecretKey");

    expect(run).toContain("cleanupCaptured");
    expect(run).toContain("placeOrder(");
    expect(run).toContain("cancelOrder(");
    expect(run).toContain("updateProduct(");
    expect(run).toContain("runLifecycleAfterGuards");
    expect(run).not.toContain('"use server"');
    expect(run).not.toContain("console.log(process.env.DATABASE_URL");

    const example = read(".env.example");
    expect(example).toContain("MARKETPLACE_DEV_PROJECT_REF=");
    expect(example).not.toMatch(/MARKETPLACE_DEV_PROJECT_REF=\S+/);

    const gitignore = read(".gitignore");
    expect(gitignore).toContain(".env.*");
    expect(gitignore).toContain("!.env.example");
  });

  it("does not expose the harness as a public Server Action", () => {
    const wiring = read("src/application/checkout/wiring.ts");
    expect(wiring).not.toContain("validate-real-order-lifecycle");
    expect(wiring).not.toContain('"use server"');
    const actions = read("src/app/merchant/[merchantId]/catalog/actions.ts");
    expect(actions).not.toContain("validate-real-order-lifecycle");
  });
});
