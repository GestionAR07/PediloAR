import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("root layout browser transition contract", () => {
  it("declares the global smooth-scroll behavior for Next route transitions", () => {
    const layout = read("src/app/layout.tsx");
    const styles = read("src/styles/globals.css");

    expect(styles).toContain("scroll-behavior: smooth");
    expect(layout).toContain('data-scroll-behavior="smooth"');
  });
});
