import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("qwen cart v3 static checks", () => {
  it("uses the public storefront shell on /carrito", () => {
    const shell = read("src/components/layout/site-shell.tsx");
    const page = read("src/app/carrito/page.tsx");
    const merchantPage = read("src/app/merchant/[merchantId]/page.tsx");
    const adminLayout = read("src/app/admin/layout.tsx");

    expect(shell).toContain('pathname === "/carrito"');
    expect(shell).toContain("public-storefront");
    expect(shell).toContain("max-w-3xl");
    expect(page).toContain("PublicHeader");
    expect(page).toContain("CartPageClient");
    expect(page).toContain("getPublicNavContextApp");
    expect(page).not.toContain("border-t border-border");
    expect(merchantPage).not.toContain("public-storefront");
    expect(adminLayout).not.toContain("public-storefront");
  });

  it("keeps cart navigation, hydrate gate, and honest totals", () => {
    const client = read("src/components/cart/cart-page-client.tsx");

    expect(client).toContain("if (!hydrated)");
    expect(client).toContain("isCartEmpty(cart)");
    expect(client).toContain('href="/"');
    expect(client).toContain("Ver comercios");
    expect(client).toContain('href="/checkout"');
    expect(client).toContain("Continuar");
    expect(client).toContain(
      "`/comercios/${encodeURIComponent(cart.merchantId)}`",
    );
    expect(client).toContain("Seguir comprando");
    expect(client).toContain("Vaciar carrito");
    expect(client).toContain("setLineQuantity(line.id, line.quantity - 1)");
    expect(client).toContain("setLineQuantity(line.id, line.quantity + 1)");
    expect(client).toContain("removeLine(line.id)");
    expect(client).toContain("clear()");
    expect(client).toContain("useCart");
    expect(client).toContain("./cart-provider");
    expect(client).toContain("formatConfigurationSummary");
    expect(client).toContain("calculateCartLineTotalCents");
    expect(client).toContain("Total estimado");
    expect(client).toContain(
      "El total y la disponibilidad se validan al continuar.",
    );
    expect(client).not.toContain("ProductOptionsSheet");
    expect(client).not.toContain("localStorage");
    expect(client).not.toContain("marketplace-rawson-cart-v1");
    expect(client).not.toContain("stockCap");
    expect(client).not.toContain("confirmReplaceAndAdd");
  });

  it("does not add a parallel cart store, mocks, or extra motion library", () => {
    const client = read("src/components/cart/cart-page-client.tsx");
    const page = read("src/app/carrito/page.tsx");
    const css = read("src/styles/globals.css");
    const pkg = JSON.parse(read("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    expect(client).not.toContain("createContext");
    expect(page).not.toContain("getPublicDiscoveryApp");
    expect(css).toContain("ps-cart-reveal");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain(".cart-line-card");
    expect(client).not.toContain("image.qwenlm.ai");
    expect(client).not.toContain("Pedilo");
    expect(client).not.toContain("cupón");
    expect(client).not.toContain("rating");
    expect(Object.keys(deps).join(" ")).not.toMatch(
      /framer-motion|gsap|animejs/i,
    );
  });
});
