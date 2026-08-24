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
    expect(page).toContain("Pedidos");
    expect(page).toContain("Catálogo");
    expect(page).toContain("Portada");
    expect(page).toContain("Medios de pago");
    expect(page).toContain("Envíos y zonas");
    expect(page).toContain("`/merchant/${merchantId}`");
    expect(page).toContain("`/merchant/${merchantId}/catalog`");
    expect(page).toContain("`/merchant/${merchantId}/profile`");
    expect(page).toContain("`/merchant/${merchantId}/payment-methods`");
    expect(page).toContain("`/merchant/${merchantId}/delivery`");
    expect(page).toContain("href={`/comercios/${merchantId}`}");
    expect(page).toContain("Ver tienda");
    expect(page).toContain("MerchantOrderSoundToggle");
    expect(page).toContain("MerchantInboxRealtime");
    expect(page).toContain("inbox.attention.length");
    expect(page).toContain("inbox.preparing.length");
    expect(page).toContain("inbox.ready.length");
    expect(page).toContain("inbox.today.length");
    expect(page).not.toContain("public-storefront");
    expect(page).not.toContain("← Marketplace");
    expect(page).not.toContain("← Mi comercio");
    expect(page).not.toMatch(/href=["']\/merchant["']/);
    const shell = read("src/components/layout/site-shell.tsx");
    expect(shell).toContain("function isMerchantDashboardPath");
    expect(shell).toContain("segments.length === 2");
    expect(shell).toContain('segments[0] === "merchant"');
    expect(shell).toContain("isMerchantDashboardPath(pathname)");
    expect(shell).toContain("MERCHANT_OPS_SHELL");
    expect(shell).toContain("OPERATIONAL_SHELL");
    expect(shell).toContain("merchant-ops");
    expect(shell).not.toContain("max-w-[90rem]");
    expect(shell).toContain("PUBLIC_STOREFRONT_SHELL");
    const css = read("src/styles/globals.css");
    expect(css).toContain(".merchant-ops-dashboard");
    expect(css).toContain("max-width: 90rem");
    expect(css).toContain("margin-inline: auto");
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
