import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("public checkout static checks", () => {
  it("adds Continuar on a non-empty cart and a /checkout route", () => {
    const cart = read("src/components/cart/cart-page-client.tsx");
    expect(cart).toContain("Continuar");
    expect(cart).toContain('href="/checkout"');
    expect(cart).toContain("isCartEmpty(cart)");
    expect(fs.existsSync(path.join(root, "src/app/checkout/page.tsx"))).toBe(
      true,
    );
  });

  it("blocks empty checkout without a hydration redirect loop", () => {
    const page = read("src/components/checkout/checkout-page-client.tsx");
    expect(page).toContain("if (!hydrated)");
    expect(page).toContain("isCartEmpty(cart)");
    expect(page).toContain('href="/carrito"');
    expect(page).not.toContain('router.replace("/checkout")');
    expect(page).not.toContain("router.replace('/checkout')");
  });

  it("uses real radios, labels and does not offer platform delivery", () => {
    const page = read("src/components/checkout/checkout-page-client.tsx");
    expect(page).toContain('type="radio"');
    expect(page).toContain('name="fulfillmentMethod"');
    expect(page).toContain('name="paymentMethodCode"');
    expect(page).toContain('name="customerName"');
    expect(page).toContain('name="customerPhone"');
    expect(page).toContain("Retiro en el comercio");
    expect(page).toContain("Envío a domicilio");
    expect(page).not.toContain("PLATFORM_DELIVERY");
    expect(page).not.toContain("Ahora / Más tarde");
    expect(page).toContain("aria-live");
    expect(page).toContain("focus-visible:ring-2");
    expect(page).toContain("disabled={formLocked}");
  });

  it("requires authoritative review before confirm and invalidates it on edit", () => {
    const page = read("src/components/checkout/checkout-page-client.tsx");
    expect(page).toContain("Revisar pedido");
    expect(page).toContain("Confirmar pedido");
    expect(page).toContain("showAuthoritativeReview");
    expect(page).toContain("canShowConfirmButton");
    expect(page).toContain("applyCheckoutActionFailure");
    expect(page).toContain("setReview(null)");
    expect(page).toContain("confirmLock");
    expect(page).toContain("Confirmando pedido…");
    expect(page).toContain("MERCHANT_DELIVERY");
    expect(page).toContain("street");
    expect(page).toContain('fulfillmentValue === "PICKUP"');
  });

  it("clears the cart only after success or replay success", () => {
    const page = read("src/components/checkout/checkout-page-client.tsx");
    expect(page).toContain("clear()");
    const successIndex = page.indexOf("setCheckoutSuccess");
    const clearIndex = page.indexOf("clear();");
    expect(successIndex).toBeGreaterThan(0);
    expect(clearIndex).toBeGreaterThan(successIndex);
    expect(page).toContain("applyUnknownNetworkOutcome");
    expect(page).toContain("No pudimos confirmar la respuesta del servidor.");
    expect(page).toContain("Reintentar confirmación");
    expect(page).toContain("applyCheckoutActionFailure");
    expect(page).not.toMatch(/clear\(\);\s*setError/);
    expect(page).toContain("{showConfirm ? (");
  });

  it("does not expose a public guest order GET or SQL in the UI", () => {
    const page = read("src/components/checkout/checkout-page-client.tsx");
    const actions = read("src/app/checkout/actions.ts");
    expect(page).not.toContain("/orders/");
    expect(page).not.toContain("DATABASE_URL");
    expect(page).not.toContain("SUPABASE_SECRET_KEY");
    expect(actions).toContain('"use server"');
    expect(actions).toContain("getCheckoutConfigurationAction");
    expect(actions).toContain("reviewCheckoutAction");
    expect(actions).toContain("placeOrderAction");
    expect(actions).toContain("parseCheckoutPayload");
    expect(actions).not.toMatch(/export const /);
    expect(actions).not.toContain("select(");
    expect(actions).not.toContain("DATABASE_URL");
    expect(actions).not.toContain("getDb");
  });

  it("does not add a checkout migration and does not run the lifecycle harness from tests", () => {
    const drizzleDir = path.join(root, "drizzle");
    const sqlFiles = fs
      .readdirSync(drizzleDir)
      .filter((file) => file.endsWith(".sql"));
    for (const file of sqlFiles) {
      expect(file.toLowerCase()).not.toContain("checkout_flow");
      expect(file.toLowerCase()).not.toContain("public_checkout");
    }
    const pkg = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.test).not.toContain("validate-real-order-lifecycle");
  });

  it("clears stale reviews on invalidating action failures", () => {
    const page = read("src/components/checkout/checkout-page-client.tsx");
    const invalidation = read("src/lib/checkout/review-invalidation.ts");
    expect(invalidation).toContain("PRODUCT_NOT_SELLABLE");
    expect(invalidation).toContain("INSUFFICIENT_STOCK");
    expect(invalidation).toContain("CHECKOUT_REVIEW_REQUIRED");
    expect(invalidation).toContain("clearAttemptQuote");
    expect(page).toContain("applyCheckoutActionFailure");
    expect(page).toContain("showAuthoritativeReview");
    expect(page).toContain("{showConfirm ? (");
    expect(page).not.toContain("reviewIsCurrent");
  });

  it("keeps application wiring server-only and not a Server Action", () => {
    const wiring = read("src/application/checkout/wiring.ts");
    expect(wiring).toContain('import "server-only"');
    expect(wiring).not.toContain('"use server"');
    expect(wiring).toContain("getCheckoutConfigurationApp");
    expect(wiring).toContain("reviewCheckoutApp");
    expect(wiring).toContain("placeOrderApp");
  });
});
