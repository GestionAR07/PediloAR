import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("customer account security and wiring", () => {
  it("requires an active verified account for pages and order placement", () => {
    const wiring = read("src/application/customer/wiring.ts");
    const checkout = read("src/app/checkout/actions.ts");
    expect(wiring).toContain("requireActiveUser");
    expect(checkout).toContain("requireActiveUser");
    expect(checkout).toContain("context.user.id");
    expect(checkout).toContain("placeOrderApp(parsed.value, customerUserId)");
  });

  it("enforces ownership inside both customer order SQL queries", () => {
    const repository = read(
      "src/infrastructure/db/repositories/customer-order-repository.ts",
    );
    expect(
      repository.match(/eq\(orders\.customerUserId, customerUserId\)/g),
    ).toHaveLength(2);
    expect(repository).toContain("eq(orders.id, orderId)");
  });

  it("keeps tracking inside protected account routes", () => {
    const account = read("src/app/cuenta/page.tsx");
    const list = read("src/app/cuenta/pedidos/page.tsx");
    const detail = read("src/app/cuenta/pedidos/[orderId]/page.tsx");
    const checkout = read("src/components/checkout/checkout-page-client.tsx");
    expect(account).toContain("listCustomerOrdersApp");
    expect(list).toContain("CustomerOrderCard");
    expect(detail).toContain("getCustomerOrderApp");
    expect(detail).toContain("CustomerOrderAutoRefresh");
    expect(checkout).toContain("/cuenta/pedidos/${success.orderId}");
  });

  it("adds a real customer registration without exposing admin credentials", () => {
    const action = read("src/app/registro/actions.ts");
    expect(action).toContain("supabase.auth.signUp");
    expect(action).toContain("display_name");
    expect(action).toContain("phone");
    expect(action).not.toContain("createSupabaseAdminClient");
    expect(action).not.toContain("SUPABASE_SECRET_KEY");
  });

  it("adds an ownership FK and customer-only RLS policies", () => {
    const migration = read("drizzle/0007_customer_accounts.sql");
    expect(migration).toContain(
      'FOREIGN KEY ("customer_user_id") REFERENCES "public"."user_profiles"',
    );
    expect(migration).toContain("USING (auth.uid() = customer_user_id)");
    for (const table of [
      "orders_select_own",
      "order_items_select_own",
      "order_item_options_select_own",
      "order_events_select_own",
      "deliveries_select_own",
    ]) {
      expect(migration).toContain(`CREATE POLICY "${table}"`);
    }
    expect(migration).not.toContain("USING (true)");
    expect(migration).not.toContain("WITH CHECK (true)");
  });
});
