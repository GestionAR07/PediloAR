import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const merchantRoutePages = [
  "src/app/merchant/[merchantId]/page.tsx",
  "src/app/merchant/[merchantId]/catalog/page.tsx",
  "src/app/merchant/[merchantId]/delivery/page.tsx",
  "src/app/merchant/[merchantId]/payment-methods/page.tsx",
  "src/app/merchant/[merchantId]/profile/page.tsx",
  "src/app/merchant/[merchantId]/orders/[orderId]/page.tsx",
] as const;

describe("merchant multitenancy security boundaries", () => {
  it("requires a scoped merchant role for every merchant mutation surface", () => {
    const catalog = read("src/application/catalog/wiring.ts");
    const delivery = read("src/application/merchant/delivery-wiring.ts");
    const payments = read("src/application/merchant/payment-method-wiring.ts");
    const cover = read("src/application/merchant/cover-image-wiring.ts");
    const operational = read("src/application/merchant/operational-wiring.ts");
    const orderInbox = read("src/application/merchant/order-inbox-wiring.ts");
    const orderActions = read(
      "src/application/merchant/order-actions-wiring.ts",
    );

    for (const wiring of [
      catalog,
      delivery,
      payments,
      cover,
      operational,
      orderInbox,
      orderActions,
    ]) {
      expect(wiring).toContain("requireMerchantRole");
      expect(wiring).not.toContain("requirePlatformAdmin");
    }

    expect(catalog).toContain(
      "requireMerchantRole(merchantId, CATALOG_ALLOWED_ROLES)",
    );
    expect(delivery).toContain(
      "requireMerchantRole(merchantId, DELIVERY_SETTINGS_ALLOWED_ROLES)",
    );
    expect(payments).toContain(
      "requireMerchantRole(merchantId, PAYMENT_METHOD_ALLOWED_ROLES)",
    );
    expect(cover).toContain(
      "requireMerchantRole(merchantId, MERCHANT_COVER_ALLOWED_ROLES)",
    );
    expect(operational).toContain(
      "requireMerchantRole(merchantId, MERCHANT_OPERATIONAL_ALLOWED_ROLES)",
    );
    expect(orderInbox).toContain(
      "requireMerchantRole(merchantId, MERCHANT_ORDER_ALLOWED_ROLES)",
    );
    expect(orderActions).toContain(
      "requireMerchantRole(\n    merchantId,\n    MERCHANT_ORDER_ALLOWED_ROLES,\n  )",
    );
  });

  it("keeps the merchant role matrix explicit for OWNER and STAFF", () => {
    const roleSources = [
      read("src/application/catalog/types.ts"),
      read("src/application/merchant/delivery-settings.ts"),
      read("src/application/merchant/payment-methods.ts"),
      read("src/application/merchant/cover-image.ts"),
      read("src/application/merchant/operational-availability.ts"),
      read("src/application/merchant/order-inbox.ts"),
    ];

    for (const source of roleSources) {
      expect(source).toMatch(
        /ALLOWED_ROLES\s*=\s*\["OWNER",\s*"STAFF"\]\s*as const/,
      );
    }
  });

  it("authenticates the real session and scopes membership by user, merchant and active flag", () => {
    const authorization = read("src/server/auth/authorization.ts");
    const merchantRepo = read(
      "src/infrastructure/db/repositories/merchant-repository.ts",
    );

    expect(authorization).toContain("supabase.auth.getUser()");
    expect(authorization).toContain("assertActiveProfile");
    expect(authorization).toContain("assertMerchantMembership");
    expect(authorization).toContain("eq(merchantUsers.userId, userId)");
    expect(authorization).toContain("eq(merchantUsers.active, true)");

    expect(merchantRepo).toContain("findMerchantDetailForMember");
    expect(merchantRepo).toContain(
      "eq(merchantUsers.merchantId, merchants.id)",
    );
    expect(merchantRepo).toContain("eq(merchantUsers.userId, userId)");
    expect(merchantRepo).toContain("eq(merchantUsers.active, true)");
    expect(merchantRepo).toContain(".where(eq(merchants.id, merchantId))");
  });

  it("guards every merchant workspace route before rendering scoped data", () => {
    for (const file of merchantRoutePages) {
      const page = read(file);
      expect(page, file).toContain("requireMerchantMembership");
      expect(page, file).toContain("error=forbidden");
    }

    for (const file of merchantRoutePages.filter(
      (file) => !file.endsWith("orders/[orderId]/page.tsx"),
    )) {
      expect(read(file), file).toContain("findMerchantDetailForMember");
    }
  });

  it("keeps merchant configuration and catalog persistence scoped by merchant id", () => {
    const merchantRepo = read(
      "src/infrastructure/db/repositories/merchant-repository.ts",
    );
    const deliveryRepo = read(
      "src/infrastructure/db/repositories/merchant-delivery-repository.ts",
    );
    const paymentRepo = read(
      "src/infrastructure/db/repositories/merchant-payment-method-repository.ts",
    );
    const catalogRepo = read(
      "src/infrastructure/db/repositories/catalog-repository.ts",
    );

    expect(merchantRepo).toContain(".where(eq(merchants.id, merchantId))");
    expect(deliveryRepo).toContain(
      "eq(merchantDeliveryZones.merchantId, merchantId)",
    );
    expect(deliveryRepo).toContain(".where(eq(merchants.id, merchantId))");
    expect(paymentRepo).toContain(
      "eq(merchantPaymentMethods.merchantId, merchantId)",
    );
    expect(catalogRepo).toContain("eq(products.merchantId, merchantId)");
    expect(catalogRepo).toContain(
      "eq(merchantCategories.merchantId, merchantId)",
    );
  });

  it("keeps direct authenticated merchant writes deny-by-default in the RLS baseline", () => {
    const migration = read("drizzle/0001_auth_foundation.sql");
    const merchantOwnedTables = [
      "merchants",
      "merchant_users",
      "merchant_opening_intervals",
      "merchant_delivery_zones",
      "merchant_payment_methods",
      "merchant_categories",
      "products",
      "product_option_groups",
      "product_option_choices",
      "orders",
      "order_items",
      "order_item_options",
      "order_events",
      "deliveries",
    ];

    for (const table of merchantOwnedTables) {
      expect(migration).toContain(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
    }

    expect(migration).not.toMatch(
      /CREATE POLICY[\s\S]*ON "(?:products|merchant_delivery_zones|merchant_payment_methods|orders)"[\s\S]*FOR (?:INSERT|UPDATE|DELETE|ALL)/,
    );
  });

  it("scopes private Realtime order broadcasts to the authenticated merchant membership", () => {
    const migration = read("drizzle/0005_merchant_order_private_broadcast.sql");

    expect(migration).toContain("'merchant-orders:' || NEW.merchant_id::text");
    expect(migration).toContain("mu.user_id = auth.uid()");
    expect(migration).toContain("mu.active = true");
    expect(migration).toContain(
      "realtime.topic() = ('merchant-orders:' || mu.merchant_id::text)",
    );
  });
});
