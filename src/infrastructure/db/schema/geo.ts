import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAtColumn, idColumn, updatedAtColumn } from "./columns";

/**
 * Geography: Province 1:N City 1:N Zone.
 * No pilot city hardcoding — data arrives via seeds later.
 */
export const provinces = pgTable(
  "provinces",
  {
    id: idColumn(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("provinces_code_uidx").on(table.code),
    check("provinces_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check("provinces_code_not_blank", sql`length(btrim(${table.code})) > 0`),
  ],
);

export const cities = pgTable(
  "cities",
  {
    id: idColumn(),
    provinceId: uuid("province_id")
      .notNull()
      .references(() => provinces.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    /** IANA timezone id (e.g. America/Argentina/Catamarca). Not a timestamptz. */
    timezone: text("timezone").notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("cities_province_slug_uidx").on(table.provinceId, table.slug),
    index("cities_province_id_idx").on(table.provinceId),
    check("cities_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check("cities_slug_not_blank", sql`length(btrim(${table.slug})) > 0`),
    check(
      "cities_timezone_not_blank",
      sql`length(btrim(${table.timezone})) > 0`,
    ),
  ],
);

export const zones = pgTable(
  "zones",
  {
    id: idColumn(),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("zones_city_slug_uidx").on(table.cityId, table.slug),
    index("zones_city_id_idx").on(table.cityId),
    check("zones_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check("zones_slug_not_blank", sql`length(btrim(${table.slug})) > 0`),
  ],
);
