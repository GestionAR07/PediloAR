import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const merchantFiles = [
  "src/app/comercios/[merchantId]/page.tsx",
  "src/components/storefront/merchant-catalog-client.tsx",
  "src/components/storefront/product-options-sheet.tsx",
  "src/components/storefront/public-brand-wordmark.tsx",
  "src/components/layout/site-shell.tsx",
  "src/styles/globals.css",
  "src/components/ui/public-icons.tsx",
];

describe("qwen merchant storefront v2 static checks", () => {
  it("keeps the real merchant catalog, cart, and options sheet", () => {
    const page = read("src/app/comercios/[merchantId]/page.tsx");
    const catalog = read(
      "src/components/storefront/merchant-catalog-client.tsx",
    );
    const sheet = read("src/components/storefront/product-options-sheet.tsx");

    expect(page).toContain("getPublicMerchantCatalogApp");
    expect(page).toContain("getPublicNavContextApp");
    expect(page).toContain("merchant.name");
    expect(page).toContain("merchant.description");
    expect(page).toContain("merchant.zoneName");
    expect(page).toContain("merchant.cityName");
    expect(page).toContain("merchant.availabilityLabel");
    expect(page).toContain("merchant.availabilityTone");
    expect(page).toContain("merchant.hoursLabel");
    expect(page).toContain("merchant.hoursDetail");
    expect(page).toContain("merchant.logistics.pickupAvailable");
    expect(page).toContain("merchant.logistics.deliveryAvailable");
    expect(page).toContain("merchant.logistics.deliveryFeeLabel");
    expect(page).toContain("merchant.logistics.minimumOrderLabel");
    expect(page).toContain("merchant.logistics.estimatedMinutesLabel");
    expect(page).toContain("merchant.logistics.preparationMinutesLabel");
    expect(page).toContain("merchant.paymentMethods");
    expect(page).toContain("method.code");
    expect(page).toContain("method.label");
    expect(page).toContain("method.instructions");
    expect(page).toContain("MerchantCatalogClient");
    expect(page).not.toContain("PublicBrandWordmark");
    expect(page).toContain("categories={merchant.categories}");
    expect(page).toContain("products={merchant.products}");
    expect(page).toContain("`/?zone=${encodeURIComponent(zone)}`");
    expect(page).toContain("← Volver al marketplace");
    expect(page).not.toContain("requireMerchantRole");
    expect(page).not.toContain("MERCHANT_DISCOVERY_COVER_IMAGE");

    expect(catalog).toContain("useCart");
    expect(catalog).toContain("tryAdd");
    expect(catalog).toContain("confirmReplaceAndAdd");
    expect(catalog).toContain("resolveStockCap");
    expect(catalog).toContain("product.canAddToCart");
    expect(catalog).toContain("product.hasOptions");
    expect(catalog).toContain("product.imageUrl");
    expect(catalog).toContain("product.statusLabel");
    expect(catalog).toContain("product.sellable");
    expect(catalog).toContain('categoryId !== "all"');
    expect(catalog).toContain("product.name.toLowerCase().includes(q)");
    expect(catalog).toContain("Elegir opciones");
    expect(catalog).toContain("Ver opciones");
    expect(catalog).toContain("Agregar");
    expect(catalog).toContain("Ver detalle");
    expect(catalog).toContain('href="/carrito"');
    expect(catalog).toContain("ProductOptionsSheet");
    expect(catalog).not.toContain("drawer");
    expect(catalog).not.toContain("CartDrawer");
    expect(catalog).toContain("chip-active");
    expect(catalog).toContain("card-lift");
    expect(catalog).toContain("zoom-img");
    expect(catalog).toContain("grad-text");
    expect(catalog).toContain("pb-safe");
    expect(catalog).toContain("no-scrollbar");
    expect(catalog).toContain("showStickyCart");
    expect(catalog).toContain(
      "max-sm:pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]",
    );
    expect(catalog).toContain("hydrated && badgeCount > 0");

    expect(sheet).toContain("isConfiguratorSelectionValid");
    expect(sheet).toContain("buildCartConfigurationFromDraft");
    expect(sheet).toContain("calculateConfiguredUnitPriceCents");
    expect(sheet).toContain('event.key === "Escape"');
    expect(sheet).toContain("focusable");
    expect(sheet).toContain("setSingleSelection");
    expect(sheet).toContain("toggleMultipleSelection");
    expect(sheet).toContain("setQuantitySelection");
    expect(sheet).toContain("Agregar al carrito");
    expect(sheet).toContain("product.canAddToCart");
    expect(sheet).toContain('role="dialog"');
    expect(sheet).toContain("aria-modal");
    expect(sheet).toContain("max-h-[92vh]");
    expect(sheet).toContain("rounded-t-[2rem]");
    expect(sheet).toContain("grad-text");
    expect(sheet).toContain("pb-safe");
    expect(sheet).toContain("disabled={!canSubmit}");
    expect(sheet).toContain(
      "product.canAddToCart && (groups.length === 0 || valid)",
    );
  });

  it("widens the public storefront without touching merchant or admin shells", () => {
    const page = read("src/app/comercios/[merchantId]/page.tsx");
    const catalog = read(
      "src/components/storefront/merchant-catalog-client.tsx",
    );
    const shell = read("src/components/layout/site-shell.tsx");
    const merchantPage = read("src/app/merchant/[merchantId]/page.tsx");
    const adminLayout = read("src/app/admin/layout.tsx");

    expect(page).toContain("max-w-7xl");
    expect(catalog).toContain("grid-cols-1");
    expect(catalog).toContain("sm:grid-cols-2");
    expect(catalog).toContain("xl:grid-cols-3");
    expect(shell).toContain('pathname.startsWith("/comercios")');
    expect(shell).toContain("max-w-3xl");
    expect(shell).toContain("public-storefront");
    expect(merchantPage).not.toContain("public-storefront");
    expect(adminLayout).not.toContain("public-storefront");
    expect(merchantPage).not.toContain("max-w-7xl");
  });

  it("does not import webqwen mocks, fake ratings, or remote Qwen assets", () => {
    const joined = merchantFiles.map((file) => read(file)).join("\n");

    expect(joined).not.toContain("image.qwenlm.ai");
    expect(joined).not.toContain("webqwen");
    expect(joined).not.toContain("cdn.tailwindcss.com");
    expect(joined).not.toContain("googleapis.com");
    expect(joined).not.toContain("unpkg.com");
    expect(joined).not.toContain("4.8");
    expect(joined).not.toContain("50+");
    expect(joined).not.toContain("Envío gratis en tu primer pedido");
    expect(joined).not.toContain("Mi Pueblo");
    expect(joined).not.toMatch(/rating/i);
    expect(joined).not.toContain("restaurants =");
  });

  it("keeps the options CTA disabled look unambiguous without changing canSubmit", () => {
    const sheet = read("src/components/storefront/product-options-sheet.tsx");
    const css = read("src/styles/globals.css");

    expect(sheet).toContain("disabled={!canSubmit}");
    expect(css).toContain(".grad-btn:disabled");
    expect(css).toContain("background-image: none");
    expect(css).toContain("cursor: not-allowed");
  });
});
