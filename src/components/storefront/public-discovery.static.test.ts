import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("qwen public discovery v1 static checks", () => {
  it("keeps real discovery, zone query, and merchant hrefs", () => {
    const page = read("src/app/page.tsx");
    const card = read("src/components/storefront/merchant-card.tsx");
    const picker = read("src/components/storefront/zone-picker.tsx");
    const header = read("src/components/storefront/public-header.tsx");

    expect(page).toContain("getPublicDiscoveryApp");
    expect(page).toContain("params.zone");
    expect(page).toContain("MerchantCard");
    expect(page).toContain("ZonePicker");
    expect(page).toContain(
      "Todavía no hay comercios disponibles en esta zona.",
    );
    expect(page).toContain("APP_SERVICE_AREA");
    expect(page).toContain("APP_NAME");
    expect(card).toContain("href={merchant.href}");
    expect(card).toContain("merchant.availabilityLabel");
    expect(card).toContain("logistics.pickupAvailable");
    expect(card).toContain("logistics.deliveryFeeLabel");
    expect(card).toContain("logistics.estimatedMinutesLabel");
    expect(picker).toContain("`/?zone=${encodeURIComponent(zoneId)}`");
    expect(picker).toContain("writePublicZoneId");
    expect(picker).toContain("readPublicZoneId");
    expect(header).toContain('href="/carrito"');
    expect(header).toContain('href="/login"');
    expect(header).toContain("badgeCount");
    expect(header).toContain("APP_NAME");
    expect(header).not.toContain('"Cuenta"');
    expect(header).toContain("Ingresar");
    expect(header).toContain("Acceso comercios");
    expect(header).toContain('? "Acceso" : "Ingresar"');
  });

  it("does not import webqwen mocks, fake metrics, or Pedilo branding", () => {
    const files = [
      "src/app/page.tsx",
      "src/app/layout.tsx",
      "src/styles/globals.css",
      "src/components/layout/site-shell.tsx",
      "src/components/storefront/public-header.tsx",
      "src/components/storefront/zone-picker.tsx",
      "src/components/storefront/merchant-card.tsx",
      "src/components/ui/public-icons.tsx",
    ];
    const joined = files.map((file) => read(file)).join("\n");

    expect(joined).not.toContain("image.qwenlm.ai");
    expect(joined).not.toContain("webqwen");
    expect(joined).not.toContain("Pedilo");
    expect(joined).not.toContain("50+");
    expect(joined).not.toContain("4.8");
    expect(joined).not.toContain("Envío gratis en tu primer pedido");
    expect(joined).not.toContain("Mi Pueblo");
    expect(joined).not.toContain("cdn.tailwindcss.com");
    expect(joined).not.toContain("googleapis.com");
    expect(joined).not.toContain("unpkg.com");
    expect(joined).not.toContain("geolocation");
    expect(joined).not.toContain("detectLocation");
    expect(joined).not.toContain("openAuthModal");
    expect(joined).not.toContain("restaurants =");
    expect(joined).not.toMatch(/function checkout\s*\(/);
  });

  it("scopes the public skin and keeps merchant/admin shell width", () => {
    const shell = read("src/components/layout/site-shell.tsx");
    const css = read("src/styles/globals.css");
    const merchantPage = read("src/app/merchant/[merchantId]/page.tsx");
    const adminLayout = read("src/app/admin/layout.tsx");
    const globalsRoot = css.slice(0, css.indexOf(".public-storefront"));

    expect(shell).toContain('pathname === "/"');
    expect(shell).toContain('pathname.startsWith("/merchant")');
    expect(shell).toContain('pathname.startsWith("/admin")');
    expect(shell).toContain("max-w-3xl");
    expect(shell).toContain("public-storefront");
    expect(css).toContain(".public-storefront");
    expect(css).toContain("#faf8ff");
    expect(css).toContain("#7c3aed");
    expect(globalsRoot).toContain("#2f5d50");
    expect(merchantPage).not.toContain("public-storefront");
    expect(adminLayout).not.toContain("public-storefront");
  });

  it("does not change discovery hrefs or zone persistence", () => {
    const discovery = read("src/application/storefront/discovery.ts");
    const storage = read("src/lib/public-zone-storage.ts");
    expect(discovery).toContain("href: `/comercios/${merchant.id}`");
    expect(storage).toContain("mr.public.zoneId");
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain("next/font/google");
    expect(layout).toContain("Inter");
    expect(layout).toContain("Sora");
    expect(layout).not.toContain("cdn.jsdelivr.net");
  });
});
