import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("body-scroll-lock", () => {
  it("compensates measured scrollbar width and restores overflow + paddingRight", () => {
    const helper = read("src/lib/body-scroll-lock.ts");
    const sheet = read("src/components/storefront/product-options-sheet.tsx");

    expect(helper).toContain("measureScrollbarWidth");
    expect(helper).toContain(
      "window.innerWidth - document.documentElement.clientWidth",
    );
    expect(helper).toContain('body.style.overflow = "hidden"');
    expect(helper).toContain("scrollbarWidth > 0");
    expect(helper).toContain("body.style.paddingRight");
    expect(helper).toContain("snapshot.overflow");
    expect(helper).toContain("snapshot.paddingRight");
    expect(helper).not.toContain("15px");
    expect(helper).not.toContain("17px");
    expect(helper).not.toContain("scrollbar-gutter");

    expect(sheet).toContain("lockBodyScroll");
    expect(sheet).toContain("unlockBodyScroll");
    expect(sheet).not.toContain('document.body.style.overflow = "hidden"');
  });
});
