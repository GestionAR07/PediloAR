/**
 * Detect PostgreSQL unique_violation from postgres.js / node-postgres-style errors.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as {
    code?: string;
    cause?: { code?: string };
  };

  return record.code === "23505" || record.cause?.code === "23505";
}
