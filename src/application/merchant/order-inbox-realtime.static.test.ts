import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("merchant inbox realtime static checks", () => {
  it("listens only to merchant-scoped order INSERT and refreshes the server read model", () => {
    const helper = read("src/application/merchant/order-inbox-realtime.ts");
    const component = read(
      "src/components/merchant/merchant-inbox-realtime.tsx",
    );
    const page = read("src/app/merchant/[merchantId]/page.tsx");

    expect(helper).toContain('"postgres_changes"');
    expect(helper).toContain('event: "INSERT"');
    expect(helper).toContain('table: "orders"');
    expect(helper).toContain("merchant_id=eq.");
    expect(helper).not.toContain('event: "UPDATE"');
    expect(helper).not.toContain('event: "DELETE"');
    expect(helper).not.toContain('event: "*"');
    expect(helper).toContain("input.onInsert()");
    expect(helper).not.toContain("onInsert(payload");
    expect(helper).not.toContain("setOrders");
    expect(helper).not.toContain("setInbox");

    expect(component).toContain('"use client"');
    expect(component).toContain("createSupabaseBrowserClient");
    expect(component).toContain("subscribeMerchantOrderInserts");
    expect(component).toContain("router.refresh()");
    expect(component).toContain("return null");
    expect(component).not.toContain("createSupabaseAdminClient");
    expect(component).not.toContain("SUPABASE_SECRET_KEY");
    expect(component).not.toContain("setInterval");
    expect(component).not.toContain("setTimeout");
    expect(component).not.toContain("Notification");
    expect(component).not.toContain("Audio");
    expect(component).not.toContain("useState");
    expect(component).not.toContain("setOrders");

    expect(page).toContain("MerchantInboxRealtime");
    expect(page).toContain("merchantId={merchantId}");
  });

  it("does not subscribe outside the merchant dashboard", () => {
    const detail = read(
      "src/app/merchant/[merchantId]/orders/[orderId]/page.tsx",
    );
    const catalog = read("src/app/merchant/[merchantId]/catalog/page.tsx");
    const index = read("src/app/merchant/page.tsx");
    expect(detail).not.toContain("MerchantInboxRealtime");
    expect(catalog).not.toContain("MerchantInboxRealtime");
    expect(index).not.toContain("MerchantInboxRealtime");
  });

  it("does not add a Realtime migration or weaken orders RLS", () => {
    const drizzleDir = path.join(root, "drizzle");
    const sqlFiles = fs
      .readdirSync(drizzleDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    expect(sqlFiles).toEqual([
      "0000_luxuriant_puma.sql",
      "0001_auth_foundation.sql",
      "0002_fat_warlock.sql",
      "0003_needy_shocker.sql",
      "0004_brown_forgotten_one.sql",
    ]);

    for (const file of sqlFiles) {
      const sql = fs.readFileSync(path.join(drizzleDir, file), "utf8");
      expect(sql.includes("USING (true)")).toBe(false);
      expect(sql.includes("USING(true)")).toBe(false);
      expect(sql).not.toMatch(
        /CREATE POLICY\s+"[^"]*"\s+ON\s+"?orders"?[\s\S]*FOR SELECT/i,
      );
    }
  });
});
