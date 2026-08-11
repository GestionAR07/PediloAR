import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { moneyCentsColumn } from "../money-mapping";
import { createdAtColumn, idColumn, updatedAtColumn } from "./columns";
import {
  MERCHANT_STATUS_VALUES,
  MERCHANT_USER_ROLE_VALUES,
  PAYMENT_METHOD_CODE_VALUES,
  sqlInList,
} from "./enums";
import { cities, zones } from "./geo";

/**
 * merchants.status DRAFT | ACTIVE | SUSPENDED
 * platformDeliveryEnabled exists but remains operationally blocked in MVP domain.
 */
export const merchants = pgTable(
  "merchants",
  {
    id: idColumn(),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "restrict" }),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => zones.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("DRAFT"),
    pickupEnabled: boolean("pickup_enabled").notNull().default(true),
    merchantDeliveryEnabled: boolean("merchant_delivery_enabled")
      .notNull()
      .default(false),
    platformDeliveryEnabled: boolean("platform_delivery_enabled")
      .notNull()
      .default(false),
    preparationMinutes: integer("preparation_minutes").notNull().default(30),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("merchants_slug_uidx").on(table.slug),
    index("merchants_city_id_idx").on(table.cityId),
    index("merchants_status_idx").on(table.status),
    index("merchants_city_status_idx").on(table.cityId, table.status),
    check("merchants_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check("merchants_slug_not_blank", sql`length(btrim(${table.slug})) > 0`),
    check(
      "merchants_status_check",
      sql.raw(`status IN (${sqlInList(MERCHANT_STATUS_VALUES)})`),
    ),
    check(
      "merchants_preparation_minutes_check",
      sql`${table.preparationMinutes} >= 0`,
    ),
  ],
);

/**
 * Merchant staff roster (conceptual user link).
 *
 * Auth is NOT implemented. `externalUserId` is an opaque UUID reserved for the
 * future identity subject (e.g. Supabase auth.users.id once strategy is approved).
 * No FK to auth.users, no password/credentials tables.
 */
export const merchantUsers = pgTable(
  "merchant_users",
  {
    id: idColumn(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    externalUserId: uuid("external_user_id").notNull(),
    role: text("role").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("merchant_users_merchant_external_uidx").on(
      table.merchantId,
      table.externalUserId,
    ),
    index("merchant_users_merchant_id_idx").on(table.merchantId),
    check(
      "merchant_users_role_check",
      sql.raw(`role IN (${sqlInList(MERCHANT_USER_ROLE_VALUES)})`),
    ),
  ],
);

/**
 * Split daily schedules: multiple rows per weekday (e.g. 09–13 and 17–21).
 * Minutes from local midnight; evaluation uses City.timezone in application.
 */
export const merchantOpeningIntervals = pgTable(
  "merchant_opening_intervals",
  {
    id: idColumn(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    openMinute: integer("open_minute").notNull(),
    closeMinute: integer("close_minute").notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("merchant_opening_intervals_merchant_id_idx").on(table.merchantId),
    index("merchant_opening_intervals_merchant_weekday_idx").on(
      table.merchantId,
      table.weekday,
    ),
    check(
      "merchant_opening_intervals_weekday_check",
      sql`${table.weekday} >= 0 AND ${table.weekday} <= 6`,
    ),
    check(
      "merchant_opening_intervals_open_minute_check",
      sql`${table.openMinute} >= 0 AND ${table.openMinute} < 1440`,
    ),
    check(
      "merchant_opening_intervals_close_minute_check",
      sql`${table.closeMinute} > 0 AND ${table.closeMinute} <= 1440`,
    ),
    check(
      "merchant_opening_intervals_range_check",
      sql`${table.closeMinute} > ${table.openMinute}`,
    ),
  ],
);

export const merchantDeliveryZones = pgTable(
  "merchant_delivery_zones",
  {
    id: idColumn(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => zones.id, { onDelete: "restrict" }),
    deliveryFeeCents: moneyCentsColumn("delivery_fee_cents").notNull(),
    minimumOrderCents: moneyCentsColumn("minimum_order_cents").notNull(),
    estimatedMinutes: integer("estimated_minutes").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("merchant_delivery_zones_merchant_zone_uidx").on(
      table.merchantId,
      table.zoneId,
    ),
    index("merchant_delivery_zones_merchant_id_idx").on(table.merchantId),
    check(
      "merchant_delivery_zones_estimated_minutes_check",
      sql`${table.estimatedMinutes} >= 0`,
    ),
    check(
      "merchant_delivery_zones_fee_nonneg",
      sql`${table.deliveryFeeCents} >= 0`,
    ),
    check(
      "merchant_delivery_zones_minimum_nonneg",
      sql`${table.minimumOrderCents} >= 0`,
    ),
  ],
);

/** Informative merchant payment methods — platform does not process money in MVP. */
export const merchantPaymentMethods = pgTable(
  "merchant_payment_methods",
  {
    id: idColumn(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    label: text("label").notNull(),
    instructions: text("instructions").notNull().default(""),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("merchant_payment_methods_merchant_code_uidx").on(
      table.merchantId,
      table.code,
    ),
    index("merchant_payment_methods_merchant_id_idx").on(table.merchantId),
    check(
      "merchant_payment_methods_code_check",
      sql.raw(`code IN (${sqlInList(PAYMENT_METHOD_CODE_VALUES)})`),
    ),
    check(
      "merchant_payment_methods_label_not_blank",
      sql`length(btrim(${table.label})) > 0`,
    ),
  ],
);
