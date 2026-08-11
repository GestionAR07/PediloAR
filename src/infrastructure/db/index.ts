/**
 * Database access barrel.
 * Prefer importing schema for static analysis; getDb for runtime (server-only).
 */
export * from "./schema";
export * from "./money-mapping";
export * from "./env";
// Client is intentionally not re-exported here to reduce accidental client-bundle imports.
// Use: import { getDb } from "@/infrastructure/db/client"
