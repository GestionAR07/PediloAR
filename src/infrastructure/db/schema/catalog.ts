import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { moneyCentsColumn } from "../money-mapping";
import { createdAtColumn, idColumn, updatedAtColumn } from "./columns";
import {
  OPTION_SELECTION_MODE_VALUES,
  STOCK_MODE_VALUES,
  sqlInList,
} from "./enums";
import { merchants } from "./merchant";

/** Global marketplace taxonomy (not merchant menu sections). */
export const marketplaceCategories = pgTable(
  "marketplace_categories",
  {
    id: idColumn(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("marketplace_categories_slug_uidx").on(table.slug),
    check(
      "marketplace_categories_name_not_blank",
      sql`length(btrim(${table.name})) > 0`,
    ),
    check(
      "marketplace_categories_slug_not_blank",
      sql`length(btrim(${table.slug})) > 0`,
    ),
  ],
);

export const merchantMarketplaceCategories = pgTable(
  "merchant_marketplace_categories",
  {
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    marketplaceCategoryId: uuid("marketplace_category_id")
      .notNull()
      .references(() => marketplaceCategories.id, { onDelete: "restrict" }),
    createdAt: createdAtColumn(),
  },
  (table) => [
    primaryKey({
      name: "merchant_marketplace_categories_pk",
      columns: [table.merchantId, table.marketplaceCategoryId],
    }),
    index("merchant_marketplace_categories_category_idx").on(
      table.marketplaceCategoryId,
    ),
  ],
);

/** Internal merchant menu sections. */
export const merchantCategories = pgTable(
  "merchant_categories",
  {
    id: idColumn(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("merchant_categories_merchant_name_uidx").on(
      table.merchantId,
      table.name,
    ),
    index("merchant_categories_merchant_id_idx").on(table.merchantId),
    check(
      "merchant_categories_name_not_blank",
      sql`length(btrim(${table.name})) > 0`,
    ),
  ],
);

/**
 * Product live catalog.
 * Prefer soft deactivation (active/available) over hard delete for sellability.
 * Order line history never CASCADE-deletes with products (see order_items).
 */
export const products = pgTable(
  "products",
  {
    id: idColumn(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "restrict" }),
    merchantCategoryId: uuid("merchant_category_id")
      .notNull()
      .references(() => merchantCategories.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    priceCents: moneyCentsColumn("price_cents").notNull(),
    active: boolean("active").notNull().default(true),
    available: boolean("available").notNull().default(true),
    stockMode: text("stock_mode").notNull().default("NOT_TRACKED"),
    stockQuantity: integer("stock_quantity"),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Storage object path in bucket product-images; never a signed URL. */
    imagePath: text("image_path"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("products_merchant_id_idx").on(table.merchantId),
    index("products_merchant_category_id_idx").on(table.merchantCategoryId),
    index("products_merchant_active_idx").on(table.merchantId, table.active),
    check("products_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check("products_price_nonneg", sql`${table.priceCents} >= 0`),
    check(
      "products_stock_mode_check",
      sql.raw(`stock_mode IN (${sqlInList(STOCK_MODE_VALUES)})`),
    ),
    check(
      "products_stock_tracked_check",
      sql`(
        ${table.stockMode} <> 'TRACKED'
        OR (
          ${table.stockQuantity} IS NOT NULL
          AND ${table.stockQuantity} >= 0
        )
      )`,
    ),
  ],
);

export const productOptionGroups = pgTable(
  "product_option_groups",
  {
    id: idColumn(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    selectionMode: text("selection_mode").notNull(),
    minSelections: integer("min_selections").notNull().default(0),
    maxSelections: integer("max_selections").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("product_option_groups_product_id_idx").on(table.productId),
    check(
      "product_option_groups_name_not_blank",
      sql`length(btrim(${table.name})) > 0`,
    ),
    check(
      "product_option_groups_mode_check",
      sql.raw(`selection_mode IN (${sqlInList(OPTION_SELECTION_MODE_VALUES)})`),
    ),
    check("product_option_groups_min_nonneg", sql`${table.minSelections} >= 0`),
    check("product_option_groups_max_nonneg", sql`${table.maxSelections} >= 0`),
    check(
      "product_option_groups_bounds",
      sql`${table.maxSelections} >= ${table.minSelections}`,
    ),
    check(
      "product_option_groups_single_bounds",
      sql`${table.selectionMode} <> 'SINGLE' OR (${table.minSelections} <= 1 AND ${table.maxSelections} <= 1)`,
    ),
  ],
);

export const productOptionChoices = pgTable(
  "product_option_choices",
  {
    id: idColumn(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => productOptionGroups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceDeltaCents: moneyCentsColumn("price_delta_cents").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("product_option_choices_group_id_idx").on(table.groupId),
    check(
      "product_option_choices_name_not_blank",
      sql`length(btrim(${table.name})) > 0`,
    ),
    check(
      "product_option_choices_price_delta_nonneg",
      sql`${table.priceDeltaCents} >= 0`,
    ),
  ],
);
