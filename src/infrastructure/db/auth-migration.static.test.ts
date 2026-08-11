import fs from "node:fs";
import path from "node:path";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { deliveries, merchantUsers, orders, userProfiles } from "../db/schema";

function readAuthMigrationSql(): string {
  const sqlPath = path.resolve(
    process.cwd(),
    "drizzle",
    "0001_auth_foundation.sql",
  );
  return fs.readFileSync(sqlPath, "utf8");
}

function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

describe("auth foundation migration (static)", () => {
  it("creates user_profiles without public update policy", () => {
    const sql = stripSqlComments(readAuthMigrationSql());
    expect(sql).toContain('CREATE TABLE "user_profiles"');
    expect(sql).toContain("user_profiles_id_auth_users_id_fk");
    expect(sql).toContain('REFERENCES "auth"."users"');
    expect(sql).toContain("handle_new_auth_user");
    expect(sql).toContain("on_auth_user_created");
    expect(sql).toContain('CREATE POLICY "user_profiles_select_own"');
    expect(sql).not.toMatch(/CREATE POLICY[^;]*user_profiles[^;]*FOR UPDATE/i);
    expect(sql.includes("USING (true)")).toBe(false);
    expect(sql.includes("USING(true)")).toBe(false);
  });

  it("migrates merchant_users to user_id with unique constraint", () => {
    const sql = readAuthMigrationSql();
    expect(sql).toContain('RENAME COLUMN "external_user_id" TO "user_id"');
    expect(sql).toContain("merchant_users_merchant_user_uidx");
    expect(sql).toContain("merchant_users_user_id_user_profiles_id_fk");

    const columns = Object.values(getTableColumns(merchantUsers)).map(
      (column) => column.name,
    );
    expect(columns).toContain("user_id");
    expect(columns).not.toContain("external_user_id");
  });

  it("enables RLS on public commercial tables without permissive always-true policies", () => {
    const sql = stripSqlComments(readAuthMigrationSql());
    for (const table of [
      "orders",
      "order_items",
      "order_events",
      "deliveries",
      "products",
      "merchants",
      "user_profiles",
    ]) {
      expect(sql).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    }
    expect(sql.includes("USING (true)")).toBe(false);
    expect(sql.includes("USING(true)")).toBe(false);
  });

  it("preserves Order without delivery_id and Delivery.order_id model", () => {
    const orderCols = Object.values(getTableColumns(orders)).map((c) => c.name);
    const deliveryCols = Object.values(getTableColumns(deliveries)).map(
      (c) => c.name,
    );
    expect(orderCols).not.toContain("delivery_id");
    expect(deliveryCols).toContain("order_id");

    const baseline = fs.readFileSync(
      path.resolve(process.cwd(), "drizzle", "0000_luxuriant_puma.sql"),
      "utf8",
    );
    expect(baseline).toContain(
      'CREATE UNIQUE INDEX "deliveries_order_id_uidx"',
    );
    expect(baseline).toContain(
      'CREATE UNIQUE INDEX "orders_idempotency_key_uidx"',
    );
  });

  it("exposes user_profiles platform_role and status columns in schema", () => {
    const cols = Object.values(getTableColumns(userProfiles)).map(
      (column) => column.name,
    );
    expect(cols).toEqual(
      expect.arrayContaining(["id", "platform_role", "status", "display_name"]),
    );
  });
});
