import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function listDrizzleMigrations(): string[] {
  const dir = path.join(root, "drizzle");
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

describe("public merchant application form (static)", () => {
  const page = read("src/app/sumar-comercio/page.tsx");
  const form = read("src/app/sumar-comercio/merchant-application-form.tsx");
  const actions = read("src/app/sumar-comercio/actions.ts");
  const cta = read("src/components/storefront/public-merchant-cta.tsx");

  it("exposes /sumar-comercio without admin auth", () => {
    expect(page).not.toContain("loadAdminContext");
    expect(page).not.toContain("requirePlatformAdmin");
    expect(page).not.toContain("redirect(");
    expect(page).not.toContain("/login");
    expect(
      fs.existsSync(path.join(root, "src/app/sumar-comercio/page.tsx")),
    ).toBe(true);
  });

  it("loads geography server-side from the repository", () => {
    expect(page).toContain("listCities");
    expect(page).toContain("listZones");
    expect(page).toContain(
      "@/infrastructure/db/repositories/geography-repository",
    );
    expect(page).not.toContain("createBrowserClient");
    expect(page).not.toContain("createSupabaseBrowserClient");
    expect(form).not.toContain("listCities");
    expect(form).not.toContain("listZones");
  });

  it("wires the server action to submitMerchantApplicationApp", () => {
    expect(actions).toContain("submitMerchantApplicationApp");
    expect(form).toContain("submitMerchantApplicationAction");
    expect(actions).toContain('"use server"');
  });

  it("does not accept status, merchantId, or reviewedByUserId from form data", () => {
    expect(actions).not.toMatch(/formData\.get\(["']status["']\)/);
    expect(actions).not.toMatch(/formData\.get\(["']merchantId["']\)/);
    expect(actions).not.toMatch(/formData\.get\(["']reviewedByUserId["']\)/);
    expect(form).not.toContain('name="status"');
    expect(form).not.toContain('name="merchantId"');
    expect(form).not.toContain('name="reviewedByUserId"');
  });

  it("maps PENDING_DUPLICATE to a user-facing message", () => {
    expect(actions).toContain("PENDING_DUPLICATE");
    expect(actions).toContain(
      "Ya recibimos una solicitud pendiente para ese comercio y email.",
    );
  });

  it("does not expose application UUID on success", () => {
    expect(actions).not.toContain("applicationId");
    expect(actions).not.toContain("result.value.id");
    expect(form).toContain("Solicitud enviada");
    expect(form).not.toContain("applicationId");
    expect(form).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });

  it("includes the required public form fields only", () => {
    for (const field of [
      "businessName",
      "contactName",
      "contactEmail",
      "contactPhone",
      "cityId",
      "zoneId",
      "description",
      "message",
    ]) {
      expect(form).toContain(`name="${field}"`);
    }

    expect(form).toContain('type="email"');
    expect(form).not.toContain('name="slug"');
    expect(form).not.toContain('name="pickupEnabled"');
    expect(form).not.toContain('name="delivery"');
    expect(form).not.toContain('name="preparationMinutes"');
    expect(form).not.toContain('name="password"');
    expect(form).not.toContain("createUser");
  });

  it("filters zones by selected city on the client", () => {
    expect(form).toContain("filteredZones");
    expect(form).toContain("zone.cityId === cityId");
    expect(form).toContain("setZoneId");
    expect(form).toContain("filteredZones.some");
  });

  it("adds /sumar-comercio to the landing merchant CTA", () => {
    expect(cta).toContain('href="/sumar-comercio"');
    expect(cta).toContain("Quiero sumar mi comercio");
    expect(cta.replace(/\s+/g, " ")).toContain(
      "Enviá tus datos y revisaremos la solicitud antes de habilitarlo.",
    );
  });

  it("keeps Acceso comercios pointing to /login", () => {
    expect(cta).toContain("Acceso comercios");
    expect(cta).toContain('href="/login"');
  });

  it("does not add public policies, migrations, or schema changes", () => {
    const migrations = listDrizzleMigrations();
    expect(migrations).toHaveLength(9);
    expect(migrations.at(-1)).toBe("0008_breezy_iron_man.sql");
    expect(migrations).not.toContain("0009_");

    const schema = read("src/infrastructure/db/schema/merchant-application.ts");
    expect(schema).not.toMatch(/CREATE POLICY/i);
    expect(schema).not.toContain("public_insert");

    const repo = read(
      "src/infrastructure/db/repositories/merchant-application-repository.ts",
    );
    expect(repo).not.toMatch(/CREATE POLICY/i);

    expect(form).not.toContain("merchant-application-repository");
    expect(actions).not.toContain("merchant-application-repository");
    expect(actions).not.toContain("insertMerchantApplication");
  });
});
