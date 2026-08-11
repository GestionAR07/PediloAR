import { describe, expect, it } from "vitest";
import { getDatabaseConfig, hasDatabaseConfig } from "./env";

describe("database env config", () => {
  it("reports absence without throwing when DATABASE_URL missing", () => {
    expect(hasDatabaseConfig({})).toBe(false);
  });

  it("requires DATABASE_URL for getDatabaseConfig", () => {
    expect(() => getDatabaseConfig({})).toThrow(/DATABASE_URL/);
  });

  it("accepts a server-only DATABASE_URL", () => {
    const config = getDatabaseConfig({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/dev",
    });
    expect(config.databaseUrl).toContain("postgresql://");
  });
});
