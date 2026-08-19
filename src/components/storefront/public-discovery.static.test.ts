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
    expect(header).toContain("PublicBrandWordmark");
    expect(header).not.toContain('"Cuenta"');
    expect(header).toContain("Ingresar");
    expect(header).toContain("Acceso comercios");
    expect(header).toContain('? "Acceso" : "Ingresar"');
  });

  it("does not import webqwen mocks or fake metrics", () => {
    const files = [
      "src/app/page.tsx",
      "src/app/layout.tsx",
      "src/styles/globals.css",
      "src/components/layout/site-shell.tsx",
      "src/components/storefront/public-header.tsx",
      "src/components/storefront/public-brand-wordmark.tsx",
      "src/components/storefront/zone-picker.tsx",
      "src/components/storefront/merchant-card.tsx",
      "src/components/ui/public-icons.tsx",
    ];
    const joined = files.map((file) => read(file)).join("\n");

    expect(joined).not.toContain("image.qwenlm.ai");
    expect(joined).not.toContain("webqwen");
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

  it("shows Pedilo as the public product name via APP_NAME", () => {
    const info = read("src/lib/app-info.ts");
    const page = read("src/app/page.tsx");
    const header = read("src/components/storefront/public-header.tsx");
    const layout = read("src/app/layout.tsx");
    const wordmark = read(
      "src/components/storefront/public-brand-wordmark.tsx",
    );

    expect(info).toContain('export const APP_NAME = "Pedilo"');
    expect(info).not.toMatch(/APP_NAME = "Marketplace Rawson"/);
    expect(wordmark).toContain("APP_NAME");
    expect(wordmark).toContain("brand-wordmark-stem");
    expect(wordmark).toContain("brand-wordmark-accent");
    expect(page).toContain("PublicBrandWordmark");
    expect(page).toContain('size="hero"');
    expect(page).toContain('tone="gradient"');
    expect(header).toContain("PublicBrandWordmark");
    expect(header).toContain('size="header"');
    expect(header).toContain('tone="plain"');
    expect(layout).toContain("title: APP_NAME");
    expect(page).not.toContain("Marketplace Rawson");
    expect(header).not.toContain("Marketplace Rawson");
    expect(layout).not.toContain("Marketplace Rawson");
    expect(page).toContain("APP_SERVICE_AREA");
    expect(page).toContain("APP_TAGLINE");
  });

  it("scopes the public skin and keeps merchant/admin shell width", () => {
    const shell = read("src/components/layout/site-shell.tsx");
    const css = read("src/styles/globals.css");
    const merchantPage = read("src/app/merchant/[merchantId]/page.tsx");
    const adminLayout = read("src/app/admin/layout.tsx");
    const globalsRoot = css.slice(0, css.indexOf(".public-storefront"));

    expect(shell).toContain('pathname === "/"');
    expect(shell).toContain('pathname.startsWith("/comercios")');
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

  it("restores Qwen visual utilities with real CSS selectors", () => {
    const css = read("src/styles/globals.css");
    const page = read("src/app/page.tsx");
    const card = read("src/components/storefront/merchant-card.tsx");

    expect(css).toContain(".grad-text");
    expect(css).toContain(".grad-btn:hover");
    expect(css).toContain(".card-lift:hover");
    expect(css).toContain(".group:hover .zoom-img");
    expect(css).toContain(".glass");
    expect(css).toContain(".nav-blur");
    expect(css).toContain(".chip-active");
    expect(css).toContain(".no-scrollbar");
    expect(css).toContain(".pb-safe");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).not.toContain(".grad-btn\\:hover");
    expect(css).not.toContain(".card-lift\\:hover");
    expect(css).not.toContain(".group\\:hover");
    expect(css).not.toContain("@keyframes marquee");
    expect(css).not.toContain(".float-a");
    expect(css).not.toContain(".spin-slow");

    expect(page).toContain("pt-10 pb-10");
    expect(page).toContain("lg:pt-14");
    expect(page).not.toContain("lg:pb-28");
    expect(page).toContain("blur-[130px]");
    expect(page).toContain("lg:grid-cols-2");
    expect(page).toContain("aria-hidden");
    expect(page).not.toContain("float-a");
    expect(page).not.toContain("pulse-dot");

    expect(card).toContain("rounded-[1.75rem]");
    expect(card).toContain("card-lift");
    expect(card).toContain("zoom-img");
    expect(card).toContain("h-44");
    expect(card).not.toContain("favorite");
    expect(card).not.toMatch(/rating/i);
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
