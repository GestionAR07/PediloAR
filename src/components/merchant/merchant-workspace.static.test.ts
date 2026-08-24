import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("merchant private workspace shell", () => {
  it("exposes shared navigation with Pedidos, Catálogo and Configuración", () => {
    const nav = read("src/components/merchant/merchant-workspace-nav.tsx");
    const shell = read("src/components/merchant/merchant-workspace-page.tsx");
    const settingsNav = read(
      "src/components/merchant/merchant-settings-nav.tsx",
    );
    expect(nav).toContain('section: "orders"');
    expect(nav).toContain('section: "catalog"');
    expect(nav).toContain('section: "settings"');
    expect(nav).toContain("Pedidos");
    expect(nav).toContain("Catálogo");
    expect(nav).toContain("Configuración");
    expect(nav).not.toContain('section: "profile"');
    expect(nav).not.toContain('section: "delivery"');
    expect(nav).not.toContain('section: "payment-methods"');
    expect(nav).not.toContain("Portada");
    expect(nav).not.toContain("Envíos y zonas");
    expect(nav).not.toContain("Medios de pago");
    expect(nav).toContain("aria-current");
    expect(shell).toContain("MerchantWorkspaceNav");
    expect(shell).toContain("merchantName");
    expect(shell).toContain("Ver tienda");
    expect(shell).toContain("href={`/comercios/${merchantId}`}");
    expect(shell).toContain("APP_NAME");
    expect(shell).not.toContain("MerchantOrderSoundToggle");
    expect(shell).not.toContain("MerchantOrderStatusPanel");
    expect(shell).not.toContain("inbox.attention");
    expect(settingsNav).toContain('aria-label="Configuración del comercio"');
    expect(settingsNav).toContain("Tienda");
    expect(settingsNav).toContain("Envíos");
    expect(settingsNav).toContain("Medios de pago");
    expect(settingsNav).toContain('tab: "store"');
    expect(settingsNav).toContain('tab: "delivery"');
    expect(settingsNav).toContain('tab: "payments"');
    expect(settingsNav).toContain("aria-current");
    expect(settingsNav).toContain("`/merchant/${merchantId}/profile`");
    expect(settingsNav).toContain("`/merchant/${merchantId}/delivery`");
    expect(settingsNav).toContain("`/merchant/${merchantId}/payment-methods`");
  });

  it("limits MERCHANT_OPS_SHELL to the authorized merchant routes", () => {
    const siteShell = read("src/components/layout/site-shell.tsx");
    expect(siteShell).toContain("isMerchantWorkspacePath");
    expect(siteShell).toContain("MERCHANT_WORKSPACE_LEAVES");
    expect(siteShell).toContain('"catalog"');
    expect(siteShell).toContain('"profile"');
    expect(siteShell).toContain('"delivery"');
    expect(siteShell).toContain('"payment-methods"');
    expect(siteShell).toContain("segments.length === 2");
    expect(siteShell).toContain('leaf === "catalog"');
    expect(siteShell).toContain("segments.length === 3");
    expect(siteShell).not.toContain('"orders"');
    expect(siteShell).not.toContain("orders/");
  });

  it("wraps nested catalog routes in MerchantWorkspacePage", () => {
    const categories = read(
      "src/app/merchant/[merchantId]/catalog/categories/page.tsx",
    );
    const createProduct = read(
      "src/app/merchant/[merchantId]/catalog/products/new/page.tsx",
    );
    const editProduct = read(
      "src/app/merchant/[merchantId]/catalog/products/[productId]/page.tsx",
    );
    for (const page of [categories, createProduct, editProduct]) {
      expect(page).toContain("MerchantWorkspacePage");
      expect(page).toContain('activeSection="catalog"');
      expect(page).toContain("merchantName={merchant.name}");
    }
    expect(categories).toContain("createCategoryAction");
    expect(categories).toContain("updateCategoryAction");
    expect(categories).toContain("deleteCategoryAction");
    expect(categories).toContain("reorderCategoryAction");
    expect(categories).toContain("formAction={boundUp}");
    expect(createProduct).toContain("createProductAction");
    expect(createProduct).toContain("ProductFormSubmitButton");
    expect(createProduct).toContain('mode="create"');
    expect(createProduct).toContain("← Catálogo");
    expect(editProduct).toContain("updateProductAction");
    expect(editProduct).toContain("ProductImageEditor");
    expect(editProduct).toContain("OptionGroupsSection");
    expect(editProduct).toContain("← Catálogo");
    expect(editProduct).toContain('mode="edit"');
    expect(editProduct).toContain('query.view === "options"');
    expect(editProduct).toContain("showOptions ? (");
  });

  it("keeps functional catalog/payment/delivery/cover hooks in place", () => {
    const catalog = read("src/app/merchant/[merchantId]/catalog/page.tsx");
    const delivery = read(
      "src/app/merchant/[merchantId]/delivery/delivery-settings-form.tsx",
    );
    const payments = read(
      "src/app/merchant/[merchantId]/payment-methods/payment-methods-form.tsx",
    );
    const cover = read(
      "src/app/merchant/[merchantId]/profile/merchant-cover-editor.tsx",
    );
    expect(catalog).toContain("listProductsForMerchant");
    expect(catalog).toContain("toggleProductAvailabilityAction");
    expect(catalog).toContain('method="get"');
    expect(delivery).toContain("useActionState");
    expect(delivery).toContain("router.refresh()");
    expect(delivery).toContain("saveMerchantDeliverySettingsAction");
    expect(delivery).toContain("merchant_delivery_enabled");
    expect(delivery).toContain("Ofrecer envío a domicilio");
    expect(delivery).toContain("merchant-workspace-form-actions");
    expect(payments).toContain("useActionState");
    expect(payments).toContain("router.refresh()");
    expect(payments).toContain("noneActive");
    expect(payments).toContain("saveMerchantPaymentMethodsAction");
    expect(payments).toContain("active_${method.code}");
    expect(payments).toContain("instructions_${method.code}");
    expect(payments).toContain("merchant-workspace-payment-instructions");
    expect(payments).toContain("merchant-workspace-switch--compact");
    expect(payments).toContain("merchant-workspace-form-actions");
    expect(cover).toContain("gateProductImageBeforeUpload");
    expect(cover).toContain("upsertAction");
    expect(cover).toContain("deleteAction");
    expect(cover).toContain("router.refresh()");
  });

  it("keeps settings routes under Configuración with secondary tabs", () => {
    const profile = read("src/app/merchant/[merchantId]/profile/page.tsx");
    const delivery = read("src/app/merchant/[merchantId]/delivery/page.tsx");
    const payments = read(
      "src/app/merchant/[merchantId]/payment-methods/page.tsx",
    );
    const orders = read("src/app/merchant/[merchantId]/page.tsx");
    for (const page of [profile, delivery, payments]) {
      expect(page).toContain('activeSection="settings"');
      expect(page).toContain('title="Configuración"');
      expect(page).toContain(
        "Administrá cómo se presenta y funciona tu comercio.",
      );
      expect(page).toContain("MerchantSettingsNav");
    }
    expect(profile).toContain('activeTab="store"');
    expect(delivery).toContain('activeTab="delivery"');
    expect(payments).toContain('activeTab="payments"');
    expect(profile).toContain("Tienda");
    expect(profile).toContain("Datos del comercio");
    expect(profile).toContain("Revisá los datos y la imagen de tu comercio.");
    expect(profile).toContain("MerchantCoverEditor");
    expect(profile).toContain("upsertMerchantCoverAction");
    expect(profile).toContain("deleteMerchantCoverAction");
    expect(delivery).toContain("Envíos");
    expect(payments).toContain("Medios de pago");
    expect(orders).not.toContain("merchant-ops-account");
    expect(orders).not.toContain("Cuenta y comercio");
    expect(orders).toContain("merchant-ops-summary");
    expect(orders).toContain("MerchantInboxRealtime");
    expect(orders).toContain("MerchantOrderStatusPanel");
  });
});
