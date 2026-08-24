import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("merchant store profile presentation", () => {
  it("shows read-only merchant details before the cover editor", () => {
    const profile = read("src/app/merchant/[merchantId]/profile/page.tsx");
    const css = read("src/styles/globals.css");
    const returnBlock = profile.slice(profile.indexOf("return ("));
    const detailsIdx = returnBlock.indexOf("Datos del comercio");
    const coverIdx = returnBlock.indexOf("<MerchantCoverEditor");
    expect(detailsIdx).toBeGreaterThan(-1);
    expect(coverIdx).toBeGreaterThan(detailsIdx);
    expect(profile).toContain("merchant-workspace-store-details");
    expect(profile).toContain("{merchant.name}");
    expect(profile).toContain("{merchant.cityName} / {merchant.zoneName}");
    expect(profile).toContain("{roleLabel}");
    expect(profile).toContain("{userLabel}");
    expect(profile).toContain("formatMerchantRoleLabel");
    expect(profile).toContain("formatMerchantStatusLabel");
    expect(css).toContain(".merchant-workspace-store-details-grid");
    expect(css).toMatch(
      /@media \(min-width: 640px\)[\s\S]*\.merchant-workspace-store-details-grid[\s\S]*grid-template-columns: repeat\(2/,
    );
  });
});
