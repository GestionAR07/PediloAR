/**
 * Drizzle schema source of truth for Marketplace Rawson PostgreSQL.
 * Domain stays pure — this module is infrastructure only.
 *
 * Auth boundary: `auth.users` is owned by Supabase. We only reference its PK
 * from `user_profiles` via a controlled SQL migration (not managed by Drizzle).
 */
export * from "./enums";
export * from "./columns";
export * from "./user-profile";
export * from "./geo";
export * from "./merchant";
export * from "./catalog";
export * from "./order";
export * from "./delivery";
