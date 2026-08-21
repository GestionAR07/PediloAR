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
    expect(client.replace(/\s+/g, " ")).toContain(
      "El total final se confirma al revisar el pedido.",
    );
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

  it("prepares customer confirmation sound on the final click and plays once on success", () => {
    const client = read("src/components/checkout/checkout-page-client.tsx");
    const helper = read("src/lib/order-confirmation-sound.ts");
    const merchantSound = read("src/lib/order-notification-sound.ts");
    const confirmFn = client.slice(
      client.indexOf("async function confirmWithDraft"),
    );
    const reviewFn = client.slice(
      client.indexOf("async function handleReview"),
      client.indexOf("async function confirmWithDraft"),
    );

    expect(helper).toContain("/sounds/pedilo-order-confirmed.mp3");
    expect(helper).toContain("prepareOrderConfirmationSound");
    expect(helper).toContain("playOrderConfirmationSound");
    expect(helper).toContain("playedConfirmationOrderIds");
    const prepareFn = helper.slice(
      helper.indexOf("export async function prepareOrderConfirmationSound"),
      helper.indexOf("export async function playOrderConfirmationSound"),
    );
    expect(prepareFn).toContain("void loadConfirmationBuffer");
    expect(prepareFn).not.toMatch(/await loadConfirmationBuffer\s*\(/);
    expect(helper).not.toContain("pedilo-new-order");
    expect(helper).not.toContain("order-notification-sound");
    expect(helper).not.toContain("randomUUID");
    expect(
      fs.existsSync(
        path.join(root, "public/sounds/pedilo-order-confirmed.mp3"),
      ),
    ).toBe(true);

    expect(client).toContain("prepareOrderConfirmationSound");
    expect(client).toContain("playOrderConfirmationSound");
    expect(client).not.toContain("AudioContext");
    expect(client).not.toContain("playMerchantOrderChime");
    expect(client).not.toContain("enableMerchantOrderSound");
    expect(client.split("prepareOrderConfirmationSound").length - 1).toBe(2);
    expect(client.split("playOrderConfirmationSound").length - 1).toBe(2);

    expect(reviewFn).not.toContain("prepareOrderConfirmationSound");
    expect(reviewFn).not.toContain("playOrderConfirmationSound");
    expect(
      confirmFn.indexOf("await prepareOrderConfirmationSound()"),
    ).toBeLessThan(confirmFn.indexOf("await placeOrderAction"));
    expect(confirmFn.indexOf("if (!result.ok)")).toBeLessThan(
      confirmFn.indexOf("playOrderConfirmationSound(result.order.orderId)"),
    );
    expect(confirmFn.indexOf("await placeOrderAction")).toBeLessThan(
      confirmFn.indexOf("playOrderConfirmationSound(result.order.orderId)"),
    );

    expect(merchantSound).not.toContain("pedilo-order-confirmed");
    expect(merchantSound).not.toContain("order-confirmation-sound");
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

  it("keeps checkout section headings inside cards and clarifies review hierarchy", () => {
    const client = read("src/components/checkout/checkout-page-client.tsx");
    const css = read("src/styles/globals.css");

    expect(client).toContain("Tus datos");
    expect(client).toMatch(/<h2[\s\S]*?>\s*Cómo lo recibís\s*<\/h2>/);
    expect(client).toMatch(/<h2[\s\S]*?>\s*Cómo pagás\s*<\/h2>/);
    expect(client).toContain('className="sr-only">Cómo lo recibís</legend>');
    expect(client).toContain('className="sr-only">Cómo pagás</legend>');
    expect(client).not.toContain(
      'legend className="font-display px-1 text-lg font-extrabold',
    );
    expect(client).not.toContain("El retiro es en");
    expect(client).toContain("preparación estimada");
    expect(client).toContain("Completá ·");
    expect(client).toContain("Datos listos · Revisado");
    expect(client).toContain("Pedido revisado");
    expect(client).not.toContain("Validado por el comercio");
    expect(client).toContain("Volver a revisar");
    expect(client).toContain("El detalle validado está en la revisión");
    expect(client).toContain("checkout-review-panel order-1");
    expect(client).toContain("order-2 p-4");
    expect(client).toContain("reviewCheckoutAction");
    expect(client).toContain("placeOrderAction");
    expect(css).toContain(".checkout-input:-webkit-autofill");
    expect(css).toContain(".checkout-input:autofill");
    expect(css).toContain("box-shadow: 0 0 0 1000px #fff inset");
  });
});
