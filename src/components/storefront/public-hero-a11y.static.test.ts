import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const hero = fs.readFileSync(
  path.join(process.cwd(), "src/components/storefront/public-hero.tsx"),
  "utf8",
);

describe("public hero heading accessibility", () => {
  it("keeps a real text separator while using CSS for the visual line break", () => {
    expect(hero).toContain('Todo lo de tu zona,{" "}');
    expect(hero).toContain('<span className="grad-text block">');
    expect(hero).not.toMatch(/Todo lo de tu zona,[\s\S]{0,80}<br\s*\/?/);
  });
});
