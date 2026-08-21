import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("public storefront static checks", () => {
  it("home is the public discovery surface", () => {
    const page = read("src/app/page.tsx");
    expect(page).toContain("getPublicDiscoveryApp");
    expect(page).toContain("ZonePicker");
    expect(page).toContain("PublicDiscoverySection");
    expect(page).toContain("PublicHowItWorks");
    expect(page).toContain("PublicMerchantCta");
    expect(page).toContain("PublicFooter");
    expect(page).not.toContain("Base técnica operativa");
  });

  it("public merchant route exists without requireMerchantRole", () => {
    const page = read("src/app/comercios/[merchantId]/page.tsx");
    expect(page).toContain("getPublicMerchantCatalogApp");
    expect(page).not.toContain("requireMerchantRole");
    expect(page).not.toContain("requireMerchantMembership");
  });

  it("public payment method view includes code for future checkout", () => {
    const types = read("src/application/storefront/types.ts");
    expect(types).toContain("export type PublicPaymentMethodView");
    expect(types).toMatch(
      /export type PublicPaymentMethodView = \{[\s\S]*code: string;/,
    );
    expect(types).not.toMatch(
      /export type PublicPaymentMethodView = \{[\s\S]*createdAt/,
    );
  });

  it("wiring never exposes secret key to clients and uses signed URL helper", () => {
    const wiring = read("src/application/storefront/wiring.ts");
    expect(wiring).toContain('import "server-only"');
    expect(wiring).toContain("createProductImageSignedUrls");
    expect(wiring).toContain("createMerchantCoverSignedUrls");
    expect(wiring).toContain("listActiveMarketplaceCategoryLinksForMerchants");
    expect(wiring).not.toContain("NEXT_PUBLIC_SUPABASE_SECRET");
  });

  it("does not add a schema migration for storefront", () => {
    const drizzleDir = path.join(root, "drizzle");
    const sqlFiles = fs
      .readdirSync(drizzleDir)
      .filter((file) => file.endsWith(".sql"));
    for (const file of sqlFiles) {
      expect(file.toLowerCase()).not.toContain("storefront");
    }
    const orderSnapshots = fs.readFileSync(
      path.join(drizzleDir, "0004_brown_forgotten_one.sql"),
      "utf8",
    );
    expect(orderSnapshots).toContain("customer_name_snapshot");
    expect(orderSnapshots).not.toContain("storefront");
    expect(sqlFiles.length).toBeGreaterThan(0);
  });
});
