import { sql } from "drizzle-orm";
import {
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
  DELIVERY_PROVIDER_VALUES,
  DELIVERY_STATUS_VALUES,
  sqlInList,
} from "./enums";
import { cities, zones } from "./geo";
import { orders } from "./order";

/**
 * Logistics entity separate from Order.
 * Unique order_id enforces at most one Delivery per Order.
 * Order has no delivery_id column.
 *
 * No courierId / CourierProfile in this phase.
 */
export const deliveries = pgTable(
  "deliveries",
  {
    id: idColumn(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    provider: text("provider").notNull(),
    status: text("status").notNull().default("PENDING"),
    feeCents: moneyCentsColumn("fee_cents").notNull(),
    estimatedMinutes: integer("estimated_minutes"),
    // Address snapshot frozen at creation (may mirror order snapshot)
    addressCityId: uuid("address_city_id").references(() => cities.id, {
      onDelete: "set null",
    }),
    addressZoneId: uuid("address_zone_id").references(() => zones.id, {
      onDelete: "set null",
    }),
    addressCityNameSnapshot: text("address_city_name_snapshot"),
    addressZoneNameSnapshot: text("address_zone_name_snapshot"),
    addressStreet: text("address_street").notNull(),
    addressNumber: text("address_number").notNull(),
    addressFloorApartment: text("address_floor_apartment"),
    addressReference: text("address_reference"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("deliveries_order_id_uidx").on(table.orderId),
    index("deliveries_status_idx").on(table.status),
    check(
      "deliveries_provider_check",
      sql.raw(`provider IN (${sqlInList(DELIVERY_PROVIDER_VALUES)})`),
    ),
    check(
      "deliveries_status_check",
      sql.raw(`status IN (${sqlInList(DELIVERY_STATUS_VALUES)})`),
    ),
    check(
      "deliveries_estimated_minutes_check",
      sql`${table.estimatedMinutes} IS NULL OR ${table.estimatedMinutes} >= 0`,
    ),
    check(
      "deliveries_street_not_blank",
      sql`length(btrim(${table.addressStreet})) > 0`,
    ),
    check(
      "deliveries_number_not_blank",
      sql`length(btrim(${table.addressNumber})) > 0`,
    ),
  ],
);
