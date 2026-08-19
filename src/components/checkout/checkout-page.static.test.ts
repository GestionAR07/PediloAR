import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("qwen checkout v4 static checks", () => {
  it("uses the public storefront shell on /checkout", () => {
    const shell = read("src/components/layout/site-shell.tsx");
    const page = read("src/app/checkout/page.tsx");
    const merchantPage = read("src/app/merchant/[merchantId]/page.tsx");
    const adminLayout = read("src/app/admin/layout.tsx");

    expect(shell).toContain('pathname === "/checkout"');
    expect(shell).toContain("public-storefront");
    expect(shell).toContain("max-w-3xl");
    expect(page).toContain("PublicHeader");
    expect(page).toContain("CheckoutPageClient");
    expect(page).not.toContain("border-t border-border");
    expect(merchantPage).not.toContain("public-storefront");
    expect(adminLayout).not.toContain("public-storefront");
  });

  it("keeps the two-step review then confirm flow in place", () => {
    const client = read("src/components/checkout/checkout-page-client.tsx");

    expect(client).toContain("if (!hydrated)");
    expect(client).toContain("Revisar pedido");
    expect(client).toContain("Confirmar pedido");
    expect(client.indexOf("Revisar pedido")).toBeLessThan(
      client.lastIndexOf("Confirmar pedido"),
    );
    expect(client).toContain("reviewCheckoutAction");
    expect(client).toContain("placeOrderAction");
    expect(client).toContain("handleReview");
    expect(client).toContain("handleConfirm");
    expect(client).toContain("confirmLock");
    expect(client).toContain("clear()");
    expect(client).toContain('href="/carrito"');
    expect(client).toContain('href="/"');
    expect(client).toContain("Pedido recibido");
    expect(client).toContain("Subtotal de productos");
    expect(client).toContain(
      "Los precios definitivos se confirman al revisar el pedido.",
    );
    expect(client).toContain("El total final se");
    expect(client).toContain("confirma al revisar el pedido.");
    expect(client).toContain("Pedido mínimo de esta zona");
    expect(client).toContain("comercio lo validará al revisar.");
    expect(client).toContain("DELIVERY_MINIMUM_NOT_MET");
    expect(client).toContain("showMinimumHint");
    expect(client).not.toContain("router.push");
    expect(client).not.toContain("router.replace");
    expect(client).not.toContain("ProductOptionsSheet");
    expect(client).not.toContain("PLATFORM_DELIVERY");
    expect(client).not.toContain("createContext");
  });

  it("keeps native fields, radios, and checkout-only motion", () => {
    const client = read("src/components/checkout/checkout-page-client.tsx");
    const css = read("src/styles/globals.css");

    expect(client).toContain('name="customerName"');
    expect(client).toContain('name="customerPhone"');
    expect(client).toContain('name="fulfillmentMethod"');
    expect(client).toContain('name="deliveryZoneId"');
    expect(client).toContain('name="street"');
    expect(client).toContain('name="paymentMethodCode"');
    expect(client).toContain('type="radio"');
    expect(client).toContain('type="tel"');
    expect(client).toContain("aria-invalid");
    expect(client).toContain('role="alert"');
    expect(client).toContain('fulfillmentValue === "MERCHANT_DELIVERY"');
    expect(client).toContain("checkout-sticky-bar");
    expect(css).toContain("checkout-review-panel");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain(".checkout-choice");
  });
});
