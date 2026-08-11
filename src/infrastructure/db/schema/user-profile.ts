import { sql } from "drizzle-orm";
import { check, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAtColumn, updatedAtColumn } from "./columns";
import {
  PLATFORM_ROLE_VALUES,
  USER_PROFILE_STATUS_VALUES,
  sqlInList,
} from "./enums";

/**
 * Public profile mirrored 1:1 with Supabase `auth.users.id`.
 *
 * - FK to auth.users is enforced in SQL migration (Drizzle must not own auth schema).
 * - platform_role is only USER | ADMIN (never MERCHANT/OWNER/STAFF).
 * - Merchant membership lives on merchant_users.
 * - Default role USER via DB default + auth trigger; clients cannot self-elevate to ADMIN.
 */
export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().notNull(),
    displayName: text("display_name"),
    phone: text("phone"),
    platformRole: text("platform_role").notNull().default("USER"),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("user_profiles_platform_role_idx").on(table.platformRole),
    index("user_profiles_status_idx").on(table.status),
    check(
      "user_profiles_platform_role_check",
      sql.raw(`platform_role IN (${sqlInList(PLATFORM_ROLE_VALUES)})`),
    ),
    check(
      "user_profiles_status_check",
      sql.raw(`status IN (${sqlInList(USER_PROFILE_STATUS_VALUES)})`),
    ),
  ],
);

/** Soft-suspend style; hard deletes of auth users cascade via FK (see SQL migration). */
export type UserProfileRow = typeof userProfiles.$inferSelect;
