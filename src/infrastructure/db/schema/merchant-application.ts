import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAtColumn, idColumn, updatedAtColumn } from "./columns";
import { MERCHANT_APPLICATION_STATUS_VALUES, sqlInList } from "./enums";
import { cities, zones } from "./geo";
import { merchants } from "./merchant";
import { userProfiles } from "./user-profile";

/**
 * Pre-merchant intake requests. Not a Merchant — approval links to a DRAFT merchant later.
 * Always inserted as PENDING; review fields are enforced by status_coherence_check.
 */
export const merchantApplications = pgTable(
  "merchant_applications",
  {
    id: idColumn(),
    status: text("status").notNull().default("PENDING"),
    businessName: text("business_name").notNull(),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone").notNull(),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "restrict" }),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => zones.id, { onDelete: "restrict" }),
    description: text("description").notNull().default(""),
    message: text("message").notNull().default(""),
    merchantId: uuid("merchant_id").references(() => merchants.id, {
      onDelete: "restrict",
    }),
    reviewedAt: timestamp("reviewed_at", {
      withTimezone: true,
      mode: "date",
    }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(
      () => userProfiles.id,
      { onDelete: "restrict" },
    ),
    rejectionReason: text("rejection_reason").notNull().default(""),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("merchant_applications_status_idx").on(table.status),
    index("merchant_applications_created_at_idx").on(table.createdAt),
    index("merchant_applications_contact_email_idx").on(table.contactEmail),
    uniqueIndex("merchant_applications_merchant_id_uidx").on(table.merchantId),
    check(
      "merchant_applications_status_check",
      sql.raw(`status IN (${sqlInList(MERCHANT_APPLICATION_STATUS_VALUES)})`),
    ),
    check(
      "merchant_applications_business_name_not_blank",
      sql`length(btrim(${table.businessName})) > 0`,
    ),
    check(
      "merchant_applications_contact_name_not_blank",
      sql`length(btrim(${table.contactName})) > 0`,
    ),
    check(
      "merchant_applications_contact_email_not_blank",
      sql`length(btrim(${table.contactEmail})) > 0`,
    ),
    check(
      "merchant_applications_contact_phone_not_blank",
      sql`length(btrim(${table.contactPhone})) > 0`,
    ),
    check(
      "merchant_applications_status_coherence_check",
      sql`(
        (${table.status} = 'PENDING'
          AND ${table.merchantId} IS NULL
          AND ${table.reviewedAt} IS NULL
          AND ${table.reviewedByUserId} IS NULL
          AND length(btrim(${table.rejectionReason})) = 0)
        OR (${table.status} = 'APPROVED'
          AND ${table.merchantId} IS NOT NULL
          AND ${table.reviewedAt} IS NOT NULL
          AND ${table.reviewedByUserId} IS NOT NULL
          AND length(btrim(${table.rejectionReason})) = 0)
        OR (${table.status} = 'REJECTED'
          AND ${table.merchantId} IS NULL
          AND ${table.reviewedAt} IS NOT NULL
          AND ${table.reviewedByUserId} IS NOT NULL)
      )`,
    ),
  ],
);
