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
    const nav = read("src/components/merchant/merchant-workspace-nav.tsx");
    expect(page).toContain("MerchantWorkspaceNav");
    expect(page).toContain('activeSection="orders"');
    expect(nav).toContain("Pedidos");
    expect(nav).toContain("Catálogo");
    expect(nav).toContain("Portada");
    expect(nav).toContain("Medios de pago");
    expect(nav).toContain("Envíos y zonas");
    expect(nav).toContain("`/merchant/${merchantId}`");
    expect(nav).toContain("`/merchant/${merchantId}/catalog`");
    expect(nav).toContain("`/merchant/${merchantId}/profile`");
    expect(nav).toContain("`/merchant/${merchantId}/payment-methods`");
    expect(nav).toContain("`/merchant/${merchantId}/delivery`");
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
    expect(shell).toContain("function isMerchantWorkspacePath");
    expect(shell).toContain("MERCHANT_WORKSPACE_LEAVES");
    expect(shell).toContain('"catalog"');
    expect(shell).toContain('"profile"');
    expect(shell).toContain('"delivery"');
    expect(shell).toContain('"payment-methods"');
    expect(shell).toContain("segments.length === 2");
    expect(shell).toContain('leaf === "catalog"');
    expect(shell).toContain("segments.length === 3");
    expect(shell).toContain("isMerchantWorkspacePath(pathname)");
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

  it("catalog uses the shared merchant workspace shell", () => {
    const page = read("src/app/merchant/[merchantId]/catalog/page.tsx");
    expect(page).toContain("MerchantWorkspacePage");
    expect(page).toContain('activeSection="catalog"');
    expect(page).toContain("merchantName={merchant.name}");
    expect(page).toContain("Nuevo producto");
    expect(page).toContain("Productos");
    expect(page).toContain("Categorías");
    expect(page).toContain("Filtrar");
    expect(page).toContain("createProductImageSignedUrls");
    expect(page).toContain("ProductAvailabilityToggle");
    expect(page).not.toContain("← Mi comercio");
    expect(page).not.toMatch(/href=["']\/["']/);
  });

  it("product editor uses the shared merchant workspace shell", () => {
    const page = read(
      "src/app/merchant/[merchantId]/catalog/products/[productId]/page.tsx",
    );
    expect(page).toContain("MerchantWorkspacePage");
    expect(page).toContain('activeSection="catalog"');
    expect(page).toContain("merchantName={merchant.name}");
    expect(page).toContain("Editar producto");
    expect(page).toContain("← Catálogo");
    expect(page).toContain("href={`/merchant/${merchantId}/catalog`}");
    expect(page).toContain("ProductImageEditor");
    expect(page).toContain("OptionGroupsSection");
    expect(page).toContain('query.view === "options"');
    expect(page).toContain("?view=options");
    expect(page).toContain("merchant-workspace-segmented");
  });

  it("catalog categories and new product use the shared workspace shell", () => {
    const categories = read(
      "src/app/merchant/[merchantId]/catalog/categories/page.tsx",
    );
    const createProduct = read(
      "src/app/merchant/[merchantId]/catalog/products/new/page.tsx",
    );
    expect(categories).toContain("MerchantWorkspacePage");
    expect(categories).toContain('activeSection="catalog"');
    expect(categories).toContain("Categorías");
    expect(categories).toContain("createCategoryAction");
    expect(createProduct).toContain("MerchantWorkspacePage");
    expect(createProduct).toContain('activeSection="catalog"');
    expect(createProduct).toContain("Nuevo producto");
    expect(createProduct).toContain("createProductAction");
    expect(createProduct).toContain("← Catálogo");
  });

  it("profile cover uses the shared merchant workspace shell", () => {
    const page = read("src/app/merchant/[merchantId]/profile/page.tsx");
    expect(page).toContain("MerchantWorkspacePage");
    expect(page).toContain('activeSection="profile"');
    expect(page).toContain("merchantName={merchant.name}");
    expect(page).toContain("Portada del comercio");
    expect(page).toContain("MerchantCoverEditor");
    expect(page).not.toContain("← Mi comercio");
  });

  it("payment methods uses the shared merchant workspace shell", () => {
    const page = read("src/app/merchant/[merchantId]/payment-methods/page.tsx");
    expect(page).toContain("MerchantWorkspacePage");
    expect(page).toContain('activeSection="payment-methods"');
    expect(page).toContain("merchantName={merchant.name}");
    expect(page).toContain("Medios de pago");
    expect(page).toContain("PaymentMethodsForm");
    expect(page).not.toContain("← Mi comercio");
  });

  it("delivery settings uses the shared merchant workspace shell", () => {
    const page = read("src/app/merchant/[merchantId]/delivery/page.tsx");
    expect(page).toContain("MerchantWorkspacePage");
    expect(page).toContain('activeSection="delivery"');
    expect(page).toContain("merchantName={merchant.name}");
    expect(page).toContain("Envíos y zonas");
    expect(page).toContain(
      "Configurá dónde realizás entregas y cuánto cuesta el envío.",
    );
    expect(page).toContain("DeliverySettingsForm");
    expect(page).not.toContain("← Mi comercio");
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
