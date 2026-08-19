import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readMigration(): string {
  return fs.readFileSync(
    path.resolve(
      process.cwd(),
      "drizzle",
      "0005_merchant_order_private_broadcast.sql",
    ),
    "utf8",
  );
}

describe("merchant order private broadcast migration", () => {
  it("creates a SECURITY DEFINER trigger that sends only orderId", () => {
    const sql = readMigration();
    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.broadcast_merchant_order_inserted()",
    );
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("realtime.send(");
    expect(sql).toContain("jsonb_build_object('orderId', NEW.id)");
    expect(sql).toContain("'order_inserted'");
    expect(sql).toContain("'merchant-orders:' || NEW.merchant_id::text");
    expect(sql).toContain("true");
    expect(sql).toContain("AFTER INSERT ON public.orders");
    expect(sql).toContain("FOR EACH ROW");
    expect(sql).toContain(
      "EXECUTE FUNCTION public.broadcast_merchant_order_inserted()",
    );
    expect(sql).not.toContain("broadcast_changes");
    expect(sql).not.toContain("postgres_changes");
  });

  it("authorizes private broadcast SELECT for active merchant members only", () => {
    const sql = readMigration();
    expect(sql).toContain('CREATE POLICY "merchant_orders_broadcast_select"');
    expect(sql).toContain("ON realtime.messages");
    expect(sql).toContain("FOR SELECT");
    expect(sql).toContain("TO authenticated");
    expect(sql).toContain("realtime.messages.extension = 'broadcast'");
    expect(sql).toContain("realtime.topic()");
    expect(sql).toContain("public.merchant_users");
    expect(sql).toContain("mu.user_id = auth.uid()");
    expect(sql).toContain("mu.active = true");
    expect(sql).not.toContain("FOR INSERT");
    expect(sql.includes("USING (true)")).toBe(false);
    expect(sql.includes("USING(true)")).toBe(false);
  });
});
