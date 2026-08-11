import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getDatabaseConfig } from "./env";
import * as schema from "./schema";

/**
 * Lazy, server-only PostgreSQL client (postgres.js + Drizzle).
 * No connection is opened at module import time until getDb() is called.
 *
 * Never import this module from React Client Components.
 * Never import from src/domain.
 */

export type Db = ReturnType<typeof createDb>;

let cached: Db | undefined;
let cachedSql: ReturnType<typeof postgres> | undefined;

function createDb(databaseUrl: string) {
  // prepare: false is friendlier to Supabase transaction pooler (prepared statements).
  const sql = postgres(databaseUrl, {
    max: 10,
    prepare: false,
  });
  cachedSql = sql;
  return drizzle(sql, { schema });
}

/**
 * Returns a process-wide Drizzle instance. Requires DATABASE_URL.
 */
export function getDb(): Db {
  if (cached) {
    return cached;
  }

  const { databaseUrl } = getDatabaseConfig();
  cached = createDb(databaseUrl);
  return cached;
}

/**
 * Optional close for scripts/tests. App server typically keeps the pool open.
 */
export async function closeDb(): Promise<void> {
  if (cachedSql) {
    await cachedSql.end({ timeout: 5 });
  }
  cached = undefined;
  cachedSql = undefined;
}

export { schema };
