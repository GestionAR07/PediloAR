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
    expect(page).toContain("PublicDiscoverySection");
    expect(page).toContain("ZonePicker");
    expect(page).toContain("PublicMarquee");
    expect(page).toContain("PublicHero");
    expect(page).not.toContain('id="comercios"');
    expect(page).toContain("APP_SERVICE_AREA");
    expect(page).toContain("APP_NAME");
    expect(card).toContain("merchantCardHref(merchant.href, zoneId)");
    expect(card).toContain("href={href}");
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
    const merchantAccess = header.slice(
      header.indexOf("{nav.merchantHomeHref ? ("),
      header.indexOf("{nav.isAdmin ? ("),
    );
    expect(merchantAccess).toContain("href={nav.merchantHomeHref}");
    expect(merchantAccess).toContain('aria-label="Mi comercio"');
    expect(merchantAccess).toContain('className="inline-flex min-h-11');
    expect(merchantAccess).not.toContain('className="hidden rounded-full');
    expect(header).toContain("nav.accountHref");
    expect(header).toContain("href={nav.accountHref}");
    expect(header).toContain("Mi cuenta");
    expect(
      header.match(/\{!nav\.merchantHomeHref && !nav\.accountHref \? \(/g),
    ).toHaveLength(2);
    expect(header).toContain("Ingresar");
    expect(header).not.toContain("Acceso comercios");
  });

  it("does not import webqwen mocks or fake metrics", () => {
    const files = [
      "src/app/page.tsx",
      "src/app/layout.tsx",
      "src/styles/globals.css",
      "src/components/layout/site-shell.tsx",
      "src/components/storefront/public-header.tsx",
      "src/components/storefront/public-marquee.tsx",
      "src/components/storefront/public-hero.tsx",
      "src/components/storefront/public-hero-visual.tsx",
      "src/components/storefront/public-brand-mark.tsx",
      "src/components/storefront/public-brand-wordmark.tsx",
      "src/components/storefront/zone-picker.tsx",
      "src/components/storefront/public-discovery-section.tsx",
      "src/components/storefront/public-category-rail.tsx",
      "src/components/storefront/merchant-card.tsx",
      "src/components/storefront/merchant-cover-fallback.tsx",
      "src/components/storefront/public-how-it-works.tsx",
      "src/components/storefront/public-merchant-cta.tsx",
      "src/components/storefront/public-footer.tsx",
      "src/lib/filter-public-merchants.ts",
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
    expect(joined).not.toContain("Burger House");
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
    expect(wordmark).toContain("PublicBrandMark");
    expect(page).not.toContain("PublicBrandWordmark");
    expect(header).toContain("PublicBrandWordmark");
    expect(header).toContain('size="header"');
    expect(header).toContain('tone="plain"');
    expect(layout).toContain("title: APP_NAME");
    expect(page).not.toContain("Marketplace Rawson");
    expect(header).not.toContain("Marketplace Rawson");
    expect(layout).not.toContain("Marketplace Rawson");
    expect(page).toContain("APP_SERVICE_AREA");
  });

  it("scopes the public skin and keeps merchant/admin shell width", () => {
    const shell = read("src/components/layout/site-shell.tsx");
    const css = read("src/styles/globals.css");
    const merchantPage = read("src/app/merchant/[merchantId]/page.tsx");
    const adminLayout = read("src/app/admin/layout.tsx");
    const globalsRoot = css.slice(0, css.indexOf(".public-storefront"));

    expect(shell).toContain('pathname === "/"');
    expect(shell).toContain('pathname === "/carrito"');
    expect(shell).toContain('pathname === "/checkout"');
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
    const hero = read("src/components/storefront/public-hero.tsx");
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
    expect(css).toContain(".shadow-glow-pink");
    expect(css).toContain(".shadow-glow-orange");
    expect(css).not.toContain(".grad-btn\\:hover");
    expect(css).not.toContain(".card-lift\\:hover");
    expect(css).not.toContain(".group\\:hover");
    expect(css).not.toContain(".float-a");
    expect(css).not.toContain(".spin-slow");
    expect(css).not.toContain(".pulse-dot");

    expect(hero).toContain("lg:grid-cols-2");
    expect(hero).toContain("lg:pt-20");
    expect(hero).toContain("lg:pb-28");
    expect(hero).toContain("public-hero-atmosphere");
    expect(hero).toContain("aria-hidden");
    expect(hero).not.toContain("blur-[130px]");
    expect(hero).not.toContain("float-a");
    expect(hero).not.toContain("pulse-dot");
    expect(page).not.toContain("float-a");
    expect(page).not.toContain("pulse-dot");

    expect(card).toContain("rounded-[1.75rem]");
    expect(card).toContain("card-lift");
    expect(card).toContain("zoom-img");
    expect(card).toContain("h-48");
    expect(card).toContain("sm:h-52");
    expect(card).not.toContain("favorite");
    expect(card).not.toMatch(/rating/i);
  });

  it("keeps Pedilo header glass without letting scrolled copy stay readable", () => {
    const css = read("src/styles/globals.css");
    const header = read("src/components/storefront/public-header.tsx");
    const navBlur = css.slice(
      css.indexOf(".public-storefront .nav-blur {"),
      css.indexOf(".public-storefront .shadow-soft"),
    );

    expect(header).toContain("nav-blur");
    expect(header).toContain("sticky top-0 z-40");
    expect(header).toContain("border-b border-violet-100/70");
    expect(navBlur).toContain("background-color: var(--ps-cream)");
    expect(navBlur).not.toContain("backdrop-filter");
    expect(navBlur).not.toContain("0.88");
    expect(navBlur).not.toContain("0.94");
    expect(navBlur).not.toContain("rgba(");
    expect(navBlur).not.toContain("#ffffff");
    expect(navBlur).not.toContain("overflow");
  });

  it("uses native smooth anchor scrolling with sticky-header offset", () => {
    const css = read("src/styles/globals.css");
    const page = read("src/app/page.tsx");
    const hero = read("src/components/storefront/public-hero.tsx");
    const picker = read("src/components/storefront/zone-picker.tsx");

    expect(css).toMatch(/html\s*\{[^}]*scroll-behavior:\s*smooth/);
    expect(css).toMatch(
      /prefers-reduced-motion:\s*reduce[\s\S]*html\s*\{[\s\S]*scroll-behavior:\s*auto/,
    );
    expect(css).toContain(".public-storefront section[id]");
    expect(css).toContain("scroll-margin-top: 92px");

    expect(hero).toContain('href="#comercios"');
    expect(hero).toContain('href="#zona"');
    expect(hero).not.toContain("scrollIntoView");
    expect(page).not.toContain("scrollIntoView");
    expect(picker).toContain('id="zona"');
    expect(picker).not.toContain("scrollIntoView");
  });

  it("allows a sober home-only marquee and rejects aggressive motion", () => {
    const css = read("src/styles/globals.css");
    const page = read("src/app/page.tsx");
    const marquee = read("src/components/storefront/public-marquee.tsx");
    const header = read("src/components/storefront/public-header.tsx");
    const shell = read("src/components/layout/site-shell.tsx");
    const comercios = read("src/app/comercios/[merchantId]/page.tsx");
    const cart = read("src/app/carrito/page.tsx");
    const checkout = read("src/app/checkout/page.tsx");
    const login = read("src/app/login/page.tsx");

    expect(css).toContain("@keyframes marquee");
    expect(css).toContain("animation: marquee 26s linear infinite");
    expect(css).toContain(".public-marquee-track");
    expect(css).toContain(".public-marquee-static");
    expect(css).toMatch(
      /prefers-reduced-motion:\s*reduce[\s\S]*\.public-marquee-track[\s\S]*animation:\s*none/,
    );
    expect(css).toMatch(
      /prefers-reduced-motion:\s*reduce[\s\S]*\.public-marquee-static[\s\S]*display:\s*block/,
    );
    expect(css).not.toContain(".float-a");
    expect(css).not.toContain(".float-b");
    expect(css).not.toContain(".spin-slow");
    expect(css).not.toContain(".pulse-dot");
    expect(css).not.toContain("animate-ping");
    expect(css).not.toContain("@keyframes floaty");
    expect(css).not.toContain("@keyframes pulseDot");
    expect(css).not.toContain("@keyframes spinSlow");
    expect(css).not.toContain("@keyframes badgeBounce");

    expect(marquee).toContain("APP_NAME");
    expect(marquee).toContain("APP_TAGLINE");
    expect(marquee).toContain("APP_SERVICE_AREA");
    expect(marquee).toContain("public-marquee-static");
    expect(marquee).toContain("sr-only");
    expect(marquee).not.toContain("Envío gratis");
    expect(marquee).not.toContain("50+");
    expect(marquee).not.toContain("15 minutos");
    expect(marquee).not.toContain("PEDILO");
    expect(marquee).not.toContain("App Store");
    expect(marquee).not.toContain("Google Play");
    expect(marquee).not.toContain("float-a");
    expect(marquee).not.toContain("pulse-dot");

    expect(page).toContain("PublicMarquee");
    expect(page).toContain("PublicHero");
    expect(shell).not.toContain("PublicMarquee");
    expect(comercios).not.toContain("PublicMarquee");
    expect(cart).not.toContain("PublicMarquee");
    expect(checkout).not.toContain("PublicMarquee");
    expect(login).not.toContain("PublicMarquee");
    expect(cart).not.toContain("PublicHero");
    expect(checkout).not.toContain("PublicHero");
    expect(login).not.toContain("PublicHero");

    expect(header).not.toContain('type="search"');
    expect(header).not.toContain("navSearch");
    expect(header).not.toContain("Crear cuenta");
    expect(header).not.toContain("placeholder=");
    expect(header).toContain("grad-btn");
    expect(header).toContain("shadow-glow");
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

  it("rebuilds the Qwen hero with honest copy, local mark, and no fake product data", () => {
    const hero = read("src/components/storefront/public-hero.tsx");
    const visual = read("src/components/storefront/public-hero-visual.tsx");
    const mark = read("src/components/storefront/public-brand-mark.tsx");
    const wordmark = read(
      "src/components/storefront/public-brand-wordmark.tsx",
    );
    const header = read("src/components/storefront/public-header.tsx");
    const merchantCta = read(
      "src/components/storefront/public-merchant-cta.tsx",
    );
    const page = read("src/app/page.tsx");
    const css = read("src/styles/globals.css");
    const cartPage = read("src/app/carrito/page.tsx");
    const checkoutPage = read("src/app/checkout/page.tsx");
    const cartClient = read("src/components/cart/cart-page-client.tsx");
    const checkoutClient = read(
      "src/components/checkout/checkout-page-client.tsx",
    );

    expect(hero).toContain("APP_SERVICE_AREA");
    expect(hero).toContain("Todo lo de tu zona,");
    expect(hero).toContain("en un solo lugar.");
    expect(hero).toContain("grad-text");
    expect(hero.replace(/\s+/g, " ")).toContain(
      "Elegí tu zona, descubrí comercios cercanos y armá tu pedido sin vueltas.",
    );
    expect(hero).toContain('href="#comercios"');
    expect(hero).toContain("Ver comercios");
    expect(hero).toContain('href="#zona"');
    expect(hero).toContain("Elegir zona");
    expect(hero).toContain("PublicHeroVisual");
    expect(hero).toContain("lg:grid-cols-2");
    expect(hero).not.toContain('type="search"');
    expect(hero).not.toContain("Crear cuenta");
    expect(hero).not.toContain("Populares");
    expect(hero).not.toContain("50+");
    expect(hero).not.toContain("4.8");
    expect(hero).not.toContain("4.9");
    expect(hero).not.toContain("pulse-dot");
    expect(hero).not.toContain("image.qwenlm.ai");

    expect(visual).toContain("data-hero-media-slot");
    expect(visual).toContain("/brand/pedilo-symbol.svg");
    expect(visual).toContain("/brand/pedilo-brand-tile.svg");
    expect(visual).toContain("PUBLIC_BRAND_MARK_SRC");
    expect(visual).toContain("Comercios");
    expect(visual).toContain("de tu zona");
    expect(visual).toContain("Retiro o entrega");
    expect(visual).toContain("Pedido simple");
    expect(visual).not.toContain("Pedido en camino");
    expect(visual).not.toContain("reseñas");
    expect(visual).not.toContain("Pago confirmado");
    expect(visual).not.toContain("Llega en");
    expect(visual).not.toContain("image.qwenlm.ai");
    expect(visual).not.toContain("float-a");
    expect(visual).not.toContain("spin-slow");
    expect(visual).not.toContain("h-[280px]");

    expect(mark).toContain('from "next/image"');
    expect(mark).toContain('light: "/brand/pedilo-brand-tile.svg"');
    expect(mark).toContain('dark: "/brand/pedilo-symbol.svg"');
    expect(mark).toContain('surface = "light"');
    expect(mark).toContain("src={markSrc[surface]}");
    expect(mark).toContain("width={160}");
    expect(mark).toContain("height={160}");
    expect(mark).toContain("sizes={imageSizes[size]}");
    expect(mark).toContain("unoptimized");
    expect(visual).toContain('className="object-contain"');
    expect(mark).not.toContain("<svg");
    expect(mark).toContain("h-10 w-10");
    expect(mark).toContain("sm:h-11 sm:w-11");
    expect(mark).toContain("h-8 w-8");
    expect(mark).toContain("h-12 w-12");
    expect(wordmark).toContain("PublicBrandMark");
    expect(wordmark).toContain("surface={resolvedSurface}");
    expect(wordmark).not.toContain("APP_NAME.slice(0, 1)");
    expect(header).toContain("PublicBrandWordmark");
    expect(merchantCta).toContain(
      '<PublicBrandMark size="compact" surface="dark" />',
    );
    expect(header).not.toContain('type="search"');
    expect(header).not.toContain("Crear cuenta");

    expect(
      fs.existsSync(path.join(root, "public/brand/pedilo-symbol.svg")),
    ).toBe(true);
    expect(
      fs.statSync(path.join(root, "public/brand/pedilo-symbol.svg")).size,
    ).toBeGreaterThan(1_000);
    expect(
      fs.existsSync(path.join(root, "public/brand/pedilo-brand-tile.svg")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(root, "public/brand/pedilo-app-icon.svg")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(root, "public/brand/pedilo-symbol-original.png")),
    ).toBe(true);
    expect(fs.existsSync(path.join(root, "src/app/icon.png"))).toBe(true);
    expect(fs.existsSync(path.join(root, "src/app/apple-icon.png"))).toBe(true);
    expect(
      fs.statSync(path.join(root, "src/app/icon.png")).size,
    ).toBeGreaterThan(100_000);
    expect(
      fs.statSync(path.join(root, "src/app/apple-icon.png")).size,
    ).toBeGreaterThan(10_000);

    expect(css).toContain("@keyframes ps-hero-in");
    expect(css).toMatch(
      /prefers-reduced-motion:\s*reduce[\s\S]*\.public-hero-visual[\s\S]*animation:\s*none/,
    );
    expect(css).not.toContain(".float-a");
    expect(css).not.toContain(".spin-slow");
    expect(css).not.toContain("animate-ping");

    expect(page).toContain("PublicHero");
    expect(cartPage).not.toContain("PublicHero");
    expect(checkoutPage).not.toContain("PublicHero");
    expect(cartClient).not.toContain("PublicHeroVisual");
    expect(checkoutClient).not.toContain("PublicHeroVisual");
  });

  it("upgrades discovery to compact zone, real merchant search, and honest empty states", () => {
    const page = read("src/app/page.tsx");
    const picker = read("src/components/storefront/zone-picker.tsx");
    const discovery = read(
      "src/components/storefront/public-discovery-section.tsx",
    );
    const card = read("src/components/storefront/merchant-card.tsx");
    const cover = read("src/components/storefront/merchant-cover-fallback.tsx");
    const filter = read("src/lib/filter-public-merchants.ts");
    const types = read("src/application/storefront/types.ts");
    const appDiscovery = read("src/application/storefront/discovery.ts");
    const schema = read("src/infrastructure/db/schema/merchant.ts");
    const css = read("src/styles/globals.css");
    const hero = read("src/components/storefront/public-hero.tsx");

    expect(picker).toContain('id="zona"');
    expect(picker).toContain("¿Dónde querés comprar?");
    expect(picker).toContain("Comercios en {activeZone.name}");
    expect(picker).toContain("Cambiar zona");
    expect(picker).toContain("writePublicZoneId");
    expect(picker).toContain("`/?zone=${encodeURIComponent(zoneId)}`");
    expect(picker).toContain('window.location.hash === "#zona"');

    expect(discovery).toContain('id="comercios"');
    expect(discovery).toContain("COMERCIOS CERCA TUYO");
    expect(discovery).toContain("Descubrí qué pedir hoy");
    expect(discovery).toContain("En {selectedZone.name}");
    expect(discovery).not.toContain("Resultados");
    expect(discovery).toContain('type="search"');
    expect(discovery).toContain('placeholder="Buscar comercios..."');
    expect(discovery).toContain("filterPublicMerchants");
    expect(discovery).not.toContain("product.name");
    expect(discovery).not.toContain("listPublicActiveProducts");
    expect(discovery).not.toContain("router.push");
    expect(discovery).toContain("Estamos sumando comercios en {zoneName}");
    expect(discovery).toContain("No encontramos comercios con");
    expect(discovery).toContain("No encontramos comercios en esta categoría.");
    expect(discovery).toContain("Limpiar búsqueda");
    expect(discovery).toContain("Ver todos");
    expect(discovery).toContain("PublicCategoryRail");
    expect(discovery).toContain("effectiveCategoryId");
    expect(discovery).toContain('href="/login"');
    expect(discovery).toContain("Sumar mi comercio");
    expect(discovery).toContain("grid-cols-1");
    expect(discovery).toContain("sm:grid-cols-2");
    expect(discovery).toContain("lg:grid-cols-3");
    expect(discovery).not.toContain("xl:grid-cols-4");

    expect(filter).toContain("merchant.name.toLowerCase()");
    expect(filter).toContain("merchant.description.toLowerCase()");
    expect(filter).toContain("merchant.categoryIds.includes");
    expect(filter).not.toContain("priceCents");
    expect(filter).not.toContain("imageUrl");
    expect(filter).not.toContain("categoryName");

    expect(card).toContain("MerchantCoverFallback");
    expect(card).toContain("merchant.coverUrl");
    expect(card).toContain("merchant.description");
    expect(card).toContain("logistics.estimatedMinutesLabel");
    expect(card).toContain("logistics.deliveryFeeLabel");
    expect(card).toContain("logistics.minimumOrderLabel");
    expect(card).not.toMatch(/rating/i);
    expect(card).not.toContain("popular");
    expect(card).not.toContain("favorite");
    expect(card).not.toContain("descuento");
    expect(card).not.toContain("promo");
    expect(card).not.toContain("parseFloat");
    expect(card).not.toContain("/ 100");
    expect(read("src/application/storefront/logistics.ts")).toContain(
      "moneyCents",
    );
    expect(cover).toContain("bg-gradient-to-br");
    expect(cover).not.toContain("image.qwenlm.ai");
    expect(cover).not.toContain("http");

    expect(types).toMatch(
      /export type PublicMerchantCard = \{[\s\S]*categoryIds: string\[\];[\s\S]*coverUrl: string \| null;/,
    );
    expect(types).toMatch(
      /export type PublicMarketplaceCategory = \{[\s\S]*slug: string;/,
    );
    expect(types).not.toContain("coverImagePath");
    expect(types).not.toMatch(
      /export type PublicMerchantCard = \{[^}]*imageUrl/,
    );
    expect(appDiscovery).toContain("href: `/comercios/${merchant.id}`");
    expect(appDiscovery).toContain("listMarketplaceCategoryLinksForMerchants");
    expect(appDiscovery).toContain("assemblePublicMarketplaceCategories");
    expect(appDiscovery).toContain("categoryIds:");
    expect(page).toContain("categories={discovery.categories}");
    expect(read("src/infrastructure/db/schema/catalog.ts")).toContain(
      "marketplaceCategories",
    );
    expect(read("src/lib/public-zone-storage.ts")).toContain(
      "mr.public.zoneId",
    );
    expect(schema).toContain("coverImagePath");
    expect(schema).toContain("cover_image_path");
    expect(schema).not.toContain("logo");

    expect(css).toContain(".discovery-grid");
    expect(css).toContain(".category-rail");
    expect(css).toContain(".category-tile-swatch--violet");
    expect(css).toContain("@keyframes ps-discovery-in");
    expect(css).toMatch(
      /prefers-reduced-motion:\s*reduce[\s\S]*\.discovery-grid[\s\S]*animation:\s*none/,
    );
    expect(css).toMatch(
      /prefers-reduced-motion:\s*reduce[\s\S]*\.category-tile[\s\S]*animation:\s*none/,
    );
    expect(css).not.toContain("animate-ping");
    expect(css).not.toContain("animate-pulse");
    expect(css).not.toContain("animate-bounce");

    expect(hero).toContain('href="#zona"');
    expect(hero).toContain('href="#comercios"');
    expect(page).not.toContain("PublicHeroVisual");
    expect(page).toContain("selectedZone={discovery.selectedZone}");
  });

  it("renders a real marketplace category rail without Qwen mocks or Lucide", () => {
    const rail = read("src/components/storefront/public-category-rail.tsx");
    const discovery = read(
      "src/components/storefront/public-discovery-section.tsx",
    );
    const repo = read(
      "src/infrastructure/db/repositories/storefront-repository.ts",
    );
    const wiring = read("src/application/storefront/wiring.ts");
    const pkg = JSON.parse(read("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    expect(rail).toContain("¿Qué te apetece hoy?");
    expect(rail).toContain("EXPLORÁ");
    expect(rail).toContain("aria-pressed");
    expect(rail).toContain("snap-x");
    expect(rail).toContain("no-scrollbar");
    expect(rail).toContain("Todos");
    expect(rail).toContain("marketplaceCategoryIconKind");
    expect(rail).toContain("marketplaceCategoryPalette");
    expect(rail).toContain('type="button"');
    expect(rail).not.toContain("lucide");
    expect(rail).not.toContain("const categories = [");
    expect(rail).not.toContain("rating");
    expect(rail).not.toContain("4.8");
    expect(rail).not.toContain("hamburguesas");
    expect(discovery).toContain("showCategories");
    expect(discovery).toContain("selectedZone && categories.length > 0");
    expect(repo).toContain("listActiveMarketplaceCategoryLinksForMerchants");
    expect(repo).toContain("merchantMarketplaceCategories");
    expect(repo).toContain("eq(marketplaceCategories.active, true)");
    expect(wiring).toContain("listActiveMarketplaceCategoryLinksForMerchants");
    expect(wiring).toContain("categories: []");
    expect(deps).not.toHaveProperty("lucide-react");
    expect(deps).not.toHaveProperty("lucide");
  });

  it("keeps public home within the viewport without relying on html overflow-x hidden", () => {
    const css = read("src/styles/globals.css");
    const marquee = read("src/components/storefront/public-marquee.tsx");
    const hero = read("src/components/storefront/public-hero.tsx");
    const visual = read("src/components/storefront/public-hero-visual.tsx");
    const header = read("src/components/storefront/public-header.tsx");
    const discovery = read(
      "src/components/storefront/public-discovery-section.tsx",
    );
    const rail = read("src/components/storefront/public-category-rail.tsx");
    const picker = read("src/components/storefront/zone-picker.tsx");
    const card = read("src/components/storefront/merchant-card.tsx");
    const cover = read("src/components/storefront/merchant-cover-fallback.tsx");
    const page = read("src/app/page.tsx");
    const shell = read("src/components/layout/site-shell.tsx");
    const globalsRoot = css.slice(0, css.indexOf(".public-storefront"));

    expect(globalsRoot).not.toMatch(/html\s*\{[^}]*overflow-x:\s*hidden/);
    expect(globalsRoot).not.toMatch(/body\s*\{[^}]*overflow-x:\s*hidden/);

    expect(marquee).toContain("min-w-0");
    expect(marquee).toContain("overflow-x-clip");
    expect(css).toContain(".public-marquee {");
    expect(css).toContain("overflow-x: clip");
    expect(css).toContain("width: max-content");

    expect(hero).toContain("overflow-x-clip");
    expect(hero).toContain("public-hero-atmosphere");
    expect(hero).not.toContain("absolute inset-0 overflow-hidden");
    expect(hero).toContain("min-w-0 max-w-full");
    expect(hero).toContain("break-words");
    expect(hero).not.toContain("blur-[130px]");

    expect(visual).toContain("public-hero-visual-atmosphere");
    expect(visual).toContain("data-hero-media-slot");
    expect(visual).not.toContain("blur-[70px]");
    expect(visual).not.toContain("shadow-[0_0_120px");
    expect(visual).not.toContain("sm:overflow-visible");
    expect(visual).not.toMatch(/(?:^|[\s"])w-\[300px\]/);
    expect(css).toContain(".public-hero-visual-atmosphere");
    expect(css).toContain("clamp(15.5rem, 78vw, 30rem)");
    expect(css).toContain("aspect-ratio: 12 / 13");
    expect(css).toMatch(
      /\.public-hero-visual-atmosphere[\s\S]*ellipse 46% 42%[\s\S]*transparent 100%/,
    );
    expect(css).toMatch(
      /\.public-hero-atmosphere[\s\S]*radial-gradient[\s\S]*transparent 68%/,
    );

    expect(header).toContain("min-w-0");
    expect(header).toContain("h-11");
    expect(header).toContain("w-11");

    expect(discovery).toContain("discovery-search");
    expect(discovery).toContain("min-w-0");
    expect(discovery).toContain("max-w-full");
    expect(discovery).toContain("lg:w-[22rem]");
    expect(css).toContain(".discovery-search");
    expect(rail).toContain("min-w-0");
    expect(rail).toContain("overflow-x-auto");
    expect(rail).toContain("snap-x");
    expect(rail).toContain("no-scrollbar");
    expect(css).toContain(".category-rail");
    expect(css).toContain("padding-inline-start: 0.5rem");
    expect(css).toContain("padding-inline-end: calc(100% - 5.5rem)");
    expect(css).toContain("scroll-padding-inline: 0.5rem 0");
    expect(css).toContain("padding-block: 0.625rem");
    expect(css).toContain("@media (hover: hover) and (pointer: fine)");
    expect(css).not.toContain(".category-rail-wrap::after");
    expect(css).not.toContain("mask-image");
    expect(css).not.toMatch(/html\s*\{[^}]*overflow-x:\s*hidden/);

    expect(picker).toContain("break-words");
    expect(picker).toContain("w-full min-w-0");
    expect(card).toContain("max-w-full");
    expect(card).toContain("min-w-0");
    expect(cover).toContain("isolate overflow-hidden");
    expect(cover).not.toContain("-right-8");
    expect(cover).not.toContain("-left-10");

    expect(page).toContain("min-w-0");
    expect(shell).toContain("min-w-0 max-w-full");
  });

  it("fades hero atmosphere with radial gradients instead of clipped blur boxes", () => {
    const css = read("src/styles/globals.css");
    const visual = read("src/components/storefront/public-hero-visual.tsx");
    const hero = read("src/components/storefront/public-hero.tsx");
    const header = read("src/components/storefront/public-header.tsx");
    const wordmark = read(
      "src/components/storefront/public-brand-wordmark.tsx",
    );
    const globalsRoot = css.slice(0, css.indexOf(".public-storefront"));

    expect(visual).toContain("public-hero-card-slot--a");
    expect(visual).toContain("public-hero-card-slot--b");
    expect(visual).toContain("public-hero-card-slot--c");
    expect(visual).toContain("Comercios");
    expect(visual).toContain("Retiro o entrega");
    expect(visual).toContain("Pedido simple");
    expect(visual).not.toContain("overflow-hidden sm:");
    expect(visual).not.toMatch(/className="[^"]*overflow-hidden/);
    expect(hero).toContain("public-hero-title");
    expect(css).toContain(".public-hero-title");
    expect(css).toContain("clamp(1.9rem");
    expect(css).toContain("ellipse 46% 42%");
    expect(css).toContain("left: 26%");
    const visualAtmosphere = css.slice(
      css.indexOf(".public-hero-visual-atmosphere"),
      css.indexOf(".public-hero-media-slot"),
    );
    expect(visualAtmosphere).toContain("radial-gradient");
    expect(visualAtmosphere).not.toMatch(/filter:\s*blur\(/);
    expect(visualAtmosphere).not.toContain("overflow: hidden");
    expect(hero).not.toContain("overflow-y-hidden");
    expect(globalsRoot).not.toMatch(/html\s*\{[^}]*overflow-x:\s*hidden/);
    expect(globalsRoot).not.toMatch(/body\s*\{[^}]*overflow-x:\s*hidden/);
    expect(header).toContain("max-[359px]:hidden");
    expect(header).toContain("max-[359px]:w-11");
    expect(header).toContain("UserIcon");
    expect(header).toContain("min-h-11");
    expect(header).toContain("inline-flex min-h-11 min-w-0");
    expect(wordmark).toContain("clamp(1.25rem");
    expect(css).toMatch(
      /prefers-reduced-motion:\s*reduce[\s\S]*\.public-hero-visual[\s\S]*animation:\s*none/,
    );
  });

  it("overlaps the hero wave onto discovery to hide the svg antialias seam", () => {
    const css = read("src/styles/globals.css");
    const hero = read("src/components/storefront/public-hero.tsx");
    const page = read("src/app/page.tsx");
    const discovery = read(
      "src/components/storefront/public-discovery-section.tsx",
    );

    expect(hero).toContain("public-hero-wave");
    expect(hero).toContain("text-[var(--ps-cream)]");
    expect(hero).toContain('preserveAspectRatio="none"');
    expect(css).toContain("--ps-cream: #faf8ff");
    expect(css).toMatch(
      /\.public-storefront \{[\s\S]*background-color:\s*var\(--ps-cream\)/,
    );
    expect(css).toMatch(/\.public-hero-wave \{[\s\S]*margin-bottom:\s*-1px/);
    expect(css).toMatch(
      /\.public-hero-wave::after \{[\s\S]*background-color:\s*var\(--ps-cream\)/,
    );
    expect(hero).not.toContain("border-b");
    expect(page).not.toMatch(/PublicHero[\s\S]{0,220}border-t/);
    expect(discovery).not.toMatch(/id="comercios"[^>]*border-t/);
  });
});
