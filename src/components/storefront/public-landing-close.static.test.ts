import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const PAGE = "src/app/page.tsx";
const HOW = "src/components/storefront/public-how-it-works.tsx";
const CTA = "src/components/storefront/public-merchant-cta.tsx";
const FOOTER = "src/components/storefront/public-footer.tsx";
const CSS = "src/styles/globals.css";
const ICONS = "src/components/ui/public-icons.tsx";
const CHECKOUT = "src/components/checkout/checkout-page-client.tsx";
const LOGIN = "src/app/login/page.tsx";
const CART = "src/app/carrito/page.tsx";
const CHECKOUT_PAGE = "src/app/checkout/page.tsx";
const COMERCIOS = "src/app/comercios/[merchantId]/page.tsx";

const FAKE_CLAIMS = [
  "App Store",
  "Google Play",
  "play.google",
  "apps.apple",
  "50+",
  "4.8",
  "4.9",
  "Envío gratis",
  "pago online",
  "Pago online",
  "seguimiento GPS",
  "GPS",
  "Llega en",
  "15 minutos",
  "Registrarme",
  "Crear comercio",
  "Empezar gratis",
  "Sumate gratis",
  "Más ventas",
  "Sin fijos",
  "Términos",
  "Privacidad",
  "Instagram",
  "Facebook",
  "WhatsApp",
  "Centro de ayuda",
  "image.qwenlm.ai",
  "webqwen",
  "framer-motion",
  "enviá el pedido",
];

function hrefsIn(source: string): string[] {
  const fromAttr = [...source.matchAll(/href=\{?"([^"}]+)"\}?/g)].map(
    (match) => match[1],
  );
  const fromConst = [...source.matchAll(/href:\s*"([^"]+)"/g)].map(
    (match) => match[1],
  );
  return [...new Set([...fromAttr, ...fromConst])];
}

describe("public landing close sections", () => {
  it("renders Cómo funciona after discovery on the home page", () => {
    const page = read(PAGE);
    const how = read(HOW);

    expect(page).toContain("PublicHowItWorks");
    expect(page).toContain("PublicMerchantCta");
    expect(page).toContain("PublicFooter");
    const jsx = page.slice(page.indexOf("return ("));
    expect(jsx.indexOf("<PublicDiscoverySection")).toBeLessThan(
      jsx.indexOf("<PublicHowItWorks"),
    );
    expect(jsx.indexOf("<PublicHowItWorks")).toBeLessThan(
      jsx.indexOf("<PublicMerchantCta"),
    );
    expect(jsx.indexOf("<PublicMerchantCta")).toBeLessThan(
      jsx.indexOf("<PublicFooter"),
    );

    expect(how).toContain('id="como-funciona"');
    expect(how).toContain("ASÍ DE SIMPLE");
    expect(how).toContain("Pedí cerca, sin vueltas.");
    expect(how).toContain("aria-labelledby");
    expect(how).toContain("how-it-works-heading");
    expect(how).toContain("<ol");
    expect(how).toContain("<h2");
    expect(how).toContain("<h3");
  });

  it("keeps the three real buyer steps aligned with checkout", () => {
    const how = read(HOW);
    const checkout = read(CHECKOUT);

    expect(how).toContain("01");
    expect(how).toContain("02");
    expect(how).toContain("03");
    expect(how).toContain("Elegí tu zona");
    expect(how).toContain("Encontrá los comercios disponibles cerca tuyo.");
    expect(how).toContain("Armá tu pedido");
    expect(how).toContain(
      "Elegí productos, cantidades y opciones disponibles.",
    );
    expect(how).toContain("Confirmá tu pedido");
    expect(how).toContain(
      "Completá tus datos, elegí retiro o envío si el comercio lo ofrece, y confirmá el pedido.",
    );
    expect(how).not.toContain("enviá el pedido");
    expect(checkout).toContain("Confirmar pedido");
    expect(checkout).toContain(
      "Completá tus datos, revisá el pedido y confirmá",
    );
    expect(checkout).toContain("Retiro en el comercio");
    expect(checkout).toContain("Envío a domicilio");
  });

  it("uses the real merchant login route and honest onboarding copy", () => {
    const cta = read(CTA);
    const login = read(LOGIN);

    expect(cta).toContain("PARA COMERCIOS");
    expect(cta).toContain("Tu comercio también puede estar en Pedilo.");
    expect(cta).toContain(
      "Mostrá tus productos, recibí pedidos y administrá tu operación",
    );
    expect(cta).toContain("¿Querés sumar tu comercio?");
    expect(cta.replace(/\s+/g, " ")).toContain(
      "El alta es asistida: no hay registro público.",
    );
    expect(cta).toContain("Acceso comercios");
    expect(cta).toContain('href="/login"');
    expect(cta).not.toContain("Registrarme");
    expect(cta).not.toContain("Crear comercio");
    expect(cta).not.toContain("Empezar gratis");
    expect(cta).not.toContain("<form");
    expect(login).toContain("Crear cuenta");
    expect(login).toContain("/registro");
    expect(hrefsIn(cta)).toEqual(["/login"]);
  });

  it("footer only exposes valid public links and a hydration-safe year", () => {
    const footer = read(FOOTER);
    const info = read("src/lib/app-info.ts");

    expect(footer).toContain("PublicBrandWordmark");
    expect(footer).toContain('size="compact"');
    expect(footer).toContain("APP_NAME");
    expect(footer).toContain("APP_TAGLINE");
    expect(info).toContain("Pedí cerca en Rawson y Playa Unión");
    expect(footer).toContain("Explorar");
    expect(footer).toContain("Inicio");
    expect(footer).toContain("Comercios");
    expect(footer).toContain("Elegir zona");
    expect(footer).toContain("Acceso comercios");
    expect(footer).toContain("getFullYear");
    expect(footer).not.toMatch(/© 20\d{2}/);
    expect(footer).toContain('aria-label="Explorar"');
    expect(footer).toContain('aria-label="Comercios"');
    expect(hrefsIn(footer).sort()).toEqual(
      ["/", "/#comercios", "/#zona", "/login"].sort(),
    );
  });

  it("does not add fake stats, promotions, reviews, app stores, or dead links", () => {
    const joined = [read(HOW), read(CTA), read(FOOTER), read(PAGE)].join("\n");

    for (const claim of FAKE_CLAIMS) {
      expect(joined).not.toContain(claim);
    }
    expect(joined).not.toMatch(/Soporte/);
    expect(joined).not.toContain("mailto:");
    expect(joined).not.toContain("tel:");
    expect(joined).not.toContain("reseñas");
    expect(joined).not.toContain("comercios registrados");
    expect(joined).not.toContain("ventas procesadas");
  });

  it("keeps close sections on the public home only", () => {
    expect(read(CART)).not.toContain("PublicFooter");
    expect(read(CART)).not.toContain("PublicHowItWorks");
    expect(read(CHECKOUT_PAGE)).not.toContain("PublicFooter");
    expect(read(CHECKOUT_PAGE)).not.toContain("PublicMerchantCta");
    expect(read(COMERCIOS)).not.toContain("PublicFooter");
    expect(read(LOGIN)).not.toContain("PublicFooter");
  });

  it("uses local icons, existing brand marks, and no icon library", () => {
    const how = read(HOW);
    const cta = read(CTA);
    const icons = read(ICONS);
    const pkg = read("package.json");

    expect(how).toContain("MapPinIcon");
    expect(how).toContain("ShoppingBagIcon");
    expect(how).toContain("CheckIcon");
    expect(cta).toContain("PublicBrandMark");
    expect(cta).toContain("StoreIcon");
    expect(icons).toContain("export function CheckIcon");
    expect(pkg).not.toContain("lucide-react");
    expect(pkg).not.toContain("framer-motion");
    expect(pkg).not.toContain("@heroicons");
  });

  it("keeps a landing-safe responsive structure and touch targets", () => {
    const how = read(HOW);
    const cta = read(CTA);
    const footer = read(FOOTER);
    const css = read(CSS);
    const globalsRoot = css.slice(0, css.indexOf(".public-storefront"));

    expect(how).toContain("md:grid-cols-3");
    expect(how).toContain("grid-cols-1");
    expect(how).toContain("min-w-0");
    expect(how).toContain("break-words");
    expect(cta).toContain("overflow-hidden");
    expect(cta).toContain("min-h-12");
    expect(cta).toContain("sm:grid-cols-3");
    expect(cta).toContain("lg:grid-cols-1");
    expect(footer).toContain("min-h-11");
    expect(footer).toContain("sm:grid-cols-2");
    expect(css).toContain(".how-it-works-title");
    expect(css).toContain(".merchant-cta-title");
    expect(css).toContain("clamp(1.7rem");
    expect(css).toContain(".public-footer");
    expect(css).toContain(".how-it-works-card:hover");
    expect(css).toMatch(
      /prefers-reduced-motion:\s*reduce[\s\S]*\.how-it-works-card/,
    );
    expect(css).not.toContain("@keyframes floaty");
    expect(css).not.toContain("animate-ping");
    expect(globalsRoot).not.toMatch(/html\s*\{[^}]*overflow-x:\s*hidden/);
    expect(globalsRoot).not.toMatch(/body\s*\{[^}]*overflow-x:\s*hidden/);
  });
});
