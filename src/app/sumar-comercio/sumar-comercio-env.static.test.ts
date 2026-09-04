import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const page = fs.readFileSync(
  path.join(process.cwd(), "src/app/sumar-comercio/page.tsx"),
  "utf8",
);

describe("sumar-comercio environment fallback", () => {
  it("does not query geography when DATABASE_URL is unavailable", () => {
    expect(page).toContain('import { hasDatabaseConfig } from "@/infrastructure/db/env"');
    expect(page).toContain("const databaseAvailable = hasDatabaseConfig();");
    expect(page).toMatch(
      /const \[cities, zones\] = databaseAvailable\s*\? await Promise\.all\(\[listCities\(\), listZones\(\)\]\)\s*:\s*\[\[\], \[\]\]/,
    );
  });

  it("shows a non-technical unavailable state instead of exposing database config", () => {
    expect(page).toContain(
      "Las solicitudes de comercios no están disponibles en este entorno.",
    );
    expect(page).not.toContain("DATABASE_URL");
  });
});
