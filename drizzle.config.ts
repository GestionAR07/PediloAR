import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 * Migrations are versioned under ./drizzle and applied via `npm run db:migrate`.
 * Do not use `drizzle-kit push` as the normal flow for this project.
 */
export default defineConfig({
  schema: "./src/infrastructure/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Required for migrate/studio. Generate may work without a live connection;
    // provide DATABASE_URL in .env.local for migrate against dev Supabase.
    url:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:5432/marketplace_rawson_dev",
  },
  strict: true,
  verbose: true,
});
