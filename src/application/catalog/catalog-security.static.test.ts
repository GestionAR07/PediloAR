import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("catalog management security static checks", () => {
  it("wiring requires merchant role — not platform admin", () => {
    const wiring = read("src/application/catalog/wiring.ts");
    expect(wiring).toContain("requireMerchantRole");
    expect(wiring).not.toContain("requirePlatformAdmin");
  });

  it("repository scopes product reads by merchantId", () => {
    const repo = read(
      "src/infrastructure/db/repositories/catalog-repository.ts",
    );
    expect(repo).toContain("eq(products.merchantId, merchantId)");
    expect(repo).toContain("eq(merchantCategories.merchantId, merchantId)");
  });

  it("catalog actions do not export runtime constants", () => {
    const actions = read("src/app/merchant/[merchantId]/catalog/actions.ts");
    expect(actions).toContain('"use server"');
    expect(actions).not.toMatch(/export\s+const\s+/);
  });

  it("new product page uses active categories only for assignment", () => {
    const page = read(
      "src/app/merchant/[merchantId]/catalog/products/new/page.tsx",
    );
    expect(page).toContain("listActiveMerchantCategories");
    expect(page).not.toContain("listMerchantCategories");
  });

  it("catalog filter keeps inactive categories visible for admin search", () => {
    const page = read("src/app/merchant/[merchantId]/catalog/page.tsx");
    expect(page).toContain("listMerchantCategories");
    expect(page).toContain("formatMerchantCategoryLabel");
  });

  it("deactivating category does not touch products in use case layer", () => {
    const categories = read("src/application/catalog/categories.ts");
    expect(categories).not.toContain("updateProduct");
    expect(categories).not.toContain("setProductAvailability");
  });

  it("order snapshots remain independent of catalog updates", () => {
    const orderSchema = read("src/infrastructure/db/schema/order.ts");
    expect(orderSchema).toContain("productNameSnapshot");
    expect(orderSchema).toContain('onDelete: "set null"');
    const repo = read(
      "src/infrastructure/db/repositories/catalog-repository.ts",
    );
    expect(repo).not.toContain("orderItems");
    expect(repo).not.toContain("orderItemOptions");
  });

  it("catalog RLS stays enabled without permissive policies", () => {
    const migration = read("drizzle/0001_auth_foundation.sql");
    expect(migration).toContain(
      'ALTER TABLE "products" ENABLE ROW LEVEL SECURITY',
    );
    expect(migration).not.toMatch(
      /CREATE POLICY[\s\S]*products[\s\S]*USING\s*\(\s*true\s*\)/,
    );
  });
});

describe("merchant temporary availability diagnosis", () => {
  it("documents that SUSPENDED is administrative — no pause field yet", () => {
    const merchantSchema = read("src/infrastructure/db/schema/merchant.ts");
    expect(merchantSchema).toContain("DRAFT");
    expect(merchantSchema).toContain("ACTIVE");
    expect(merchantSchema).toContain("SUSPENDED");
    expect(merchantSchema).not.toContain("temporarily_paused");
    expect(merchantSchema).not.toContain("accepting_orders");
  });
});
