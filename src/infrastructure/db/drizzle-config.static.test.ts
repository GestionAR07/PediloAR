import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("drizzle.config.ts env loading", () => {
  const config = fs.readFileSync(
    path.join(process.cwd(), "drizzle.config.ts"),
    "utf8",
  );

  it("loads .env.local explicitly for drizzle-kit", () => {
    expect(config).toContain('".env.local"');
    expect(config).toContain("loadEnvLocalFile");
  });

  it("requires DATABASE_URL via getDatabaseConfig — no localhost fallback", () => {
    expect(config).toContain("getDatabaseConfig");
    expect(config).not.toContain("127.0.0.1");
    expect(config).not.toContain("marketplace_rawson_dev");
    expect(config).not.toMatch(/postgresql:\/\/postgres:postgres@/);
  });

  it("does not enable verbose drizzle-kit output", () => {
    expect(config).toContain("verbose: false");
  });
});
