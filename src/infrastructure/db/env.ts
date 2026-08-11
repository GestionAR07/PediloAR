/**
 * Server-only database configuration.
 * Domain modules must NEVER import this file.
 */

export type DatabaseConfig = {
  databaseUrl: string;
};

export type EnvLike = Readonly<Record<string, string | undefined>>;

/**
 * Reads DATABASE_URL from the process environment.
 * Throws a clear error when missing — call only from server DB entrypoints.
 *
 * Domain and pure unit tests never need this.
 */
export function getDatabaseConfig(env: EnvLike = process.env): DatabaseConfig {
  const databaseUrl = env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required for database access. Set it in .env.local (never use NEXT_PUBLIC_*).",
    );
  }

  if (databaseUrl.startsWith("NEXT_PUBLIC_")) {
    throw new Error("DATABASE_URL must not be a NEXT_PUBLIC_ variable");
  }

  return { databaseUrl };
}

export function hasDatabaseConfig(env: EnvLike = process.env): boolean {
  return Boolean(env.DATABASE_URL?.trim());
}
