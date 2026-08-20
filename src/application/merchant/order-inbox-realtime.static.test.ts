import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const PII = [
  "customer_name",
  "customer_name_snapshot",
  "customer_phone",
  "total_cents",
  "idempotency_key",
];

describe("merchant inbox realtime static checks", () => {
  it("uses a single private Broadcast subscription and refreshes the inbox", () => {
    const helper = read("src/application/merchant/order-inbox-realtime.ts");
    const component = read(
      "src/components/merchant/merchant-inbox-realtime.tsx",
    );
    const page = read("src/app/merchant/[merchantId]/page.tsx");

    expect(helper).toContain('"broadcast"');
    expect(helper).toContain("MERCHANT_ORDER_INSERTED_EVENT");
    expect(helper).toContain("order_inserted");
    expect(helper).toContain("merchant-orders");
    expect(helper).toContain("private: true");
    expect(helper).toContain("setAuth");
    expect(helper).not.toContain("postgres_changes");
    expect(helper).not.toContain('event: "UPDATE"');
    expect(helper).not.toContain('event: "DELETE"');
    expect(helper).not.toContain("setOrders");
    expect(helper).not.toContain("setInbox");
    expect(helper).toContain("export function subscribeMerchantOrderInserts");
    expect(helper).not.toContain(
      "export async function subscribeMerchantOrderInserts",
    );
    expect(helper).toContain("if (cancelled)");
    expect(helper.indexOf("if (cancelled)")).toBeGreaterThan(
      helper.indexOf("setAuth()"),
    );
    expect(helper).not.toContain("[merchant-realtime]");
    expect(helper).not.toContain("merchantRealtimeDevLog");
    expect(helper).not.toContain("console.info");
    expect(helper).not.toContain("console.error");
    expect(helper).toContain("readMerchantOrderInsertedOrderId");
    expect(helper).toContain("input.onInsert({");
    expect(helper).not.toContain("input.onInsert()");

    expect(component).toContain('"use client"');
    expect(component).toContain("createSupabaseBrowserClient");
    expect(component.split("subscribeMerchantOrderInserts({").length - 1).toBe(
      1,
    );
    expect(component).toContain("router.refresh()");
    expect(component).toContain("unsubscribe()");
    expect(component).not.toContain("late unsubscribe");
    expect(component).toContain("}, [merchantId, router]);");
    expect(component).toContain("OrderNotificationToast");
    expect(component).toContain("recordSessionMerchantNewOrderInsert");
    expect(component).toContain("playMerchantOrderChime");
    const onInsertAt = component.indexOf("onInsert:");
    expect(component.indexOf("router.refresh()", onInsertAt)).toBeLessThan(
      component.indexOf("recordSessionMerchantNewOrderInsert", onInsertAt),
    );
    expect(component).not.toContain("postgres_changes");
    expect(component).not.toContain("createSupabaseAdminClient");
    expect(component).not.toContain("SUPABASE_SECRET_KEY");
    expect(component).not.toContain("setInterval");
    expect(component).not.toContain("new Notification");
    expect(component).not.toContain("AudioContext");
    expect(component).not.toContain("[merchant-realtime]");
    expect(component).not.toContain("merchantRealtimeDevLog");
    expect(component).not.toContain("logMerchantOrderSoundSkipped");

    expect(page).toContain("MerchantInboxRealtime");
    expect(page).toContain("merchantId={merchantId}");
  });

  it("does not put PII on the broadcast transport", () => {
    const helper = read("src/application/merchant/order-inbox-realtime.ts");
    const component = read(
      "src/components/merchant/merchant-inbox-realtime.tsx",
    );
    const sql = read("drizzle/0005_merchant_order_private_broadcast.sql");
    for (const field of PII) {
      expect(helper).not.toContain(field);
      expect(component).not.toContain(field);
      expect(sql).not.toContain(field);
    }
    expect(sql).toContain("jsonb_build_object('orderId', NEW.id)");
    expect(sql).not.toContain("NEW.*");
    expect(sql).not.toContain("to_jsonb(NEW)");
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

  it("does not weaken orders RLS and does not use USING(true)", () => {
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
      "0005_merchant_order_private_broadcast.sql",
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
