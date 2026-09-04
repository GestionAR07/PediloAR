import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("merchant multitenancy security static checks", () => {
  it("merchant authorization resolves membership for the exact merchant id", () => {
    const authorization = read("src/server/auth/authorization.ts");

    expect(authorization).toContain(
      "const membership = assertMerchantMembership(memberships, merchantId);",
    );
    expect(authorization).toContain(
      "return { ...context, membership };",
    );
    expect(authorization).not.toContain("requirePlatformAdmin();");
  });

  it("merchant detail reads require matching active membership and user id", () => {
    const repo = read(
      "src/infrastructure/db/repositories/merchant-repository.ts",
    );

    expect(repo).toContain("findMerchantDetailForMember");
    expect(repo).toContain("eq(merchantUsers.merchantId, merchants.id)");
    expect(repo).toContain("eq(merchantUsers.userId, userId)");
    expect(repo).toContain("eq(merchantUsers.active, true)");
    expect(repo).toContain(".where(eq(merchants.id, merchantId))");
  });

  it("catalog, payments, delivery and cover wiring all authorize merchant roles", () => {
    const files = [
      "src/application/catalog/wiring.ts",
      "src/application/merchant/payment-method-wiring.ts",
      "src/application/merchant/delivery-wiring.ts",
      "src/application/merchant/cover-image-wiring.ts",
    ];

    for (const rel of files) {
      const source = read(rel);
      expect(source, rel).toContain("requireMerchantRole");
      expect(source, rel).not.toContain("requirePlatformAdmin");
    }
  });

  it("payment method reads and upserts stay scoped by merchant id", () => {
    const repo = read(
      "src/infrastructure/db/repositories/merchant-payment-method-repository.ts",
    );

    expect(repo).toContain(
      "eq(merchantPaymentMethods.merchantId, merchantId)",
    );
    expect(repo).toContain("merchantId,");
    expect(repo).toContain("eq(merchantPaymentMethods.code, method.code)");
  });

  it("delivery settings and zone upserts stay scoped by merchant id", () => {
    const repo = read(
      "src/infrastructure/db/repositories/merchant-delivery-repository.ts",
    );

    expect(repo).toContain("eq(merchants.id, merchantId)");
    expect(repo).toContain(
      "eq(merchantDeliveryZones.merchantId, merchantId)",
    );
    expect(repo).toContain("eq(merchantDeliveryZones.zoneId, zone.zoneId)");
  });

  it("cover image reads and writes target only the requested merchant id", () => {
    const repo = read(
      "src/infrastructure/db/repositories/merchant-repository.ts",
    );
    const wiring = read("src/application/merchant/cover-image-wiring.ts");

    expect(repo).toContain("findMerchantCoverPath");
    expect(repo).toContain("setMerchantCoverImagePath");
    expect(repo).toContain(".where(eq(merchants.id, merchantId))");
    expect(wiring).toContain("await requireCoverAccess(merchantId);");
  });

  it("merchant server actions delegate writes through authorized application wiring", () => {
    const catalogActions = read(
      "src/app/merchant/[merchantId]/catalog/actions.ts",
    );
    const paymentActions = read(
      "src/app/merchant/[merchantId]/payment-methods/actions.ts",
    );
    const profileActions = read(
      "src/app/merchant/[merchantId]/profile/actions.ts",
    );

    expect(catalogActions).toContain("@/application/catalog/wiring");
    expect(paymentActions).toContain(
      "@/application/merchant/payment-method-wiring",
    );
    expect(profileActions).toContain(
      "@/application/merchant/cover-image-wiring",
    );

    for (const source of [catalogActions, paymentActions, profileActions]) {
      expect(source).not.toContain("@/infrastructure/db/client");
      expect(source).not.toContain("requirePlatformAdmin");
    }
  });
});
