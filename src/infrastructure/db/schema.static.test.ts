import fs from "node:fs";
import path from "node:path";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  deliveries,
  merchantDeliveryZones,
  orderEvents,
  orderItemOptions,
  orderItems,
  orders,
  products,
} from "./schema";

function columnNames(table: Parameters<typeof getTableColumns>[0]): string[] {
  return Object.values(getTableColumns(table)).map((column) => column.name);
}

function readInitialMigrationSql(): string {
  const drizzleDir = path.resolve(process.cwd(), "drizzle");
  const files = fs
    .readdirSync(drizzleDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  expect(files.length).toBeGreaterThan(0);
  return fs.readFileSync(path.join(drizzleDir, files[0]!), "utf8");
}

describe("persistence schema (static)", () => {
  it("orders has no delivery_id (relation stays on deliveries.order_id)", () => {
    const names = columnNames(orders);
    expect(names).not.toContain("delivery_id");
    expect(names).toContain("merchant_id");
    expect(names).toContain("idempotency_key");
    expect(names).toContain("fulfillment_method");
    expect(names).toContain("item_subtotal_cents");
    expect(names).toContain("payment_method_code");
    expect(names).toContain("delivery_street");
    expect(names).toContain("delivery_city_name_snapshot");
    expect(names).toContain("customer_name_snapshot");
    expect(names).toContain("customer_phone_snapshot");
    expect(names).toContain("merchant_name_snapshot");
  });

  it("deliveries reference order_id uniquely", () => {
    const names = columnNames(deliveries);
    expect(names).toContain("order_id");
    expect(names).not.toContain("courier_id");

    const sql = readInitialMigrationSql();
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "deliveries_order_id_uidx" ON "deliveries"',
    );
  });

  it("orders encode global idempotency uniqueness and shape", () => {
    const sql = readInitialMigrationSql();
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "orders_idempotency_key_uidx" ON "orders"',
    );
    expect(sql).toContain("orders_idempotency_key_shape");
  });

  it("products stock constraints encode TRACKED quantity rules", () => {
    const sql = readInitialMigrationSql();
    expect(sql).toContain("products_stock_mode_check");
    expect(sql).toContain("products_stock_tracked_check");
    expect(columnNames(products)).toContain("stock_mode");
    expect(columnNames(products)).toContain("stock_quantity");
  });

  it("merchant delivery zones unique on merchant + zone", () => {
    const sql = readInitialMigrationSql();
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "merchant_delivery_zones_merchant_zone_uidx"',
    );
  });

  it("merchant marketplace categories use composite primary key", () => {
    const sql = readInitialMigrationSql();
    expect(sql).toContain(
      'CONSTRAINT "merchant_marketplace_categories_pk" PRIMARY KEY("merchant_id","marketplace_category_id")',
    );
  });

  it("order history tables keep snapshot columns independent of live catalog", () => {
    expect(columnNames(orderItems)).toEqual(
      expect.arrayContaining([
        "product_name_snapshot",
        "unit_price_cents",
        "quantity",
        "line_total_cents",
        "item_notes",
        "product_id",
      ]),
    );
    expect(columnNames(orderItemOptions)).toEqual(
      expect.arrayContaining([
        "option_group_name_snapshot",
        "option_choice_name_snapshot",
        "price_delta_cents",
        "quantity",
      ]),
    );
    expect(columnNames(orderEvents)).toEqual(
      expect.arrayContaining([
        "order_id",
        "from_status",
        "to_status",
        "actor_type",
        "created_at",
      ]),
    );

    const sql = readInitialMigrationSql();
    expect(sql).toMatch(
      /order_items_product_id_products_id_fk[\s\S]*ON DELETE set null/i,
    );
  });

  it("order contact and merchant snapshots are required text columns", () => {
    const names = columnNames(orders);
    expect(names).toContain("customer_name_snapshot");
    expect(names).toContain("customer_phone_snapshot");
    expect(names).toContain("merchant_name_snapshot");

    const migration = fs.readFileSync(
      path.resolve(process.cwd(), "drizzle", "0004_brown_forgotten_one.sql"),
      "utf8",
    );
    expect(migration).toContain(
      'ADD COLUMN "customer_name_snapshot" text NOT NULL',
    );
    expect(migration).toContain(
      'ADD COLUMN "customer_phone_snapshot" text NOT NULL',
    );
    expect(migration).toContain(
      'ADD COLUMN "merchant_name_snapshot" text NOT NULL',
    );
    expect(migration).toContain("orders_customer_name_snapshot_not_blank");
    expect(migration).toContain("orders_customer_phone_snapshot_not_blank");
    expect(migration).toContain("orders_merchant_name_snapshot_not_blank");
  });

  it("money columns use bigint (not float) in schema and migration", () => {
    const moneyColumns = [
      getTableColumns(products).priceCents,
      getTableColumns(orders).totalCents,
      getTableColumns(deliveries).feeCents,
      getTableColumns(merchantDeliveryZones).deliveryFeeCents,
    ];

    for (const column of moneyColumns) {
      expect(column.getSQLType()).toBe("bigint");
    }

    const sql = readInitialMigrationSql();
    expect(sql).toContain('"price_cents" bigint');
    expect(sql).toContain('"total_cents" bigint');
    expect(sql).not.toMatch(/price_cents" (real|double|numeric|float)/i);
  });

  it("split merchant hours and option selection modes are present", () => {
    const sql = readInitialMigrationSql();
    expect(sql).toContain("merchant_opening_intervals");
    expect(sql).toContain("merchant_opening_intervals_range_check");
    expect(sql).toContain("SINGLE");
    expect(sql).toContain("MULTIPLE");
    expect(sql).toContain("QUANTITY");
  });
});
