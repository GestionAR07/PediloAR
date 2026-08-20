import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("merchant back navigation", () => {
  it("merchant dashboard returns to the public marketplace", () => {
    const page = read("src/app/merchant/[merchantId]/page.tsx");
    expect(page).toContain('href="/"');
    expect(page).toContain("← Marketplace");
    expect(page).not.toContain("← Mi comercio");
    // Single-membership resolver still lives on /merchant index.
    expect(page).not.toMatch(/href=["']\/merchant["']/);
    expect(page).toContain("Gestionar catálogo");
    expect(page).toContain("Portada del comercio");
    expect(page).toContain("Medios de pago");
    expect(page).toContain("Envíos y zonas");
    expect(page).toContain("href={`/merchant/${merchantId}/profile`}");
    expect(page).toContain("href={`/merchant/${merchantId}/payment-methods`}");
    expect(page).toContain("href={`/merchant/${merchantId}/delivery`}");
  });

  it("catalog returns to the merchant dashboard", () => {
    const page = read("src/app/merchant/[merchantId]/catalog/page.tsx");
    expect(page).toContain("← Mi comercio");
    expect(page).toContain("href={`/merchant/${merchantId}`}");
    expect(page).not.toMatch(/href=["']\/["']/);
  });

  it("product editor returns to the catalog", () => {
    const page = read(
      "src/app/merchant/[merchantId]/catalog/products/[productId]/page.tsx",
    );
    expect(page).toContain("← Catálogo");
    expect(page).toContain("href={`/merchant/${merchantId}/catalog`}");
  });

  it("profile cover returns to the merchant dashboard", () => {
    const page = read("src/app/merchant/[merchantId]/profile/page.tsx");
    expect(page).toContain("← Mi comercio");
    expect(page).toContain("href={`/merchant/${merchantId}`}");
    expect(page).toContain("Portada del comercio");
  });

  it("payment methods returns to the merchant dashboard", () => {
    const page = read("src/app/merchant/[merchantId]/payment-methods/page.tsx");
    expect(page).toContain("← Mi comercio");
    expect(page).toContain("href={`/merchant/${merchantId}`}");
    expect(page).toContain("Medios de pago");
  });

  it("delivery settings returns to the merchant dashboard", () => {
    const page = read("src/app/merchant/[merchantId]/delivery/page.tsx");
    expect(page).toContain("← Mi comercio");
    expect(page).toContain("href={`/merchant/${merchantId}`}");
    expect(page).toContain("Envíos y zonas");
    expect(page).toContain(
      "Configurá dónde realizás entregas y cuánto cuesta el envío.",
    );
  });

  it("order detail returns to the merchant dashboard", () => {
    const page = read(
      "src/app/merchant/[merchantId]/orders/[orderId]/page.tsx",
    );
    expect(page).toContain("← Mi comercio");
    expect(page).toContain("href={`/merchant/${merchantId}`}");
  });

  it("merchant index still auto-resolves a single membership", () => {
    const page = read("src/app/merchant/page.tsx");
    expect(page).toContain("memberships.length === 1");
    expect(page).toContain("redirect(`/merchant/${only.merchantId}`)");
  });
});
