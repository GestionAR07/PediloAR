import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("option group editor UX", () => {
  const section = read(
    "src/app/merchant/[merchantId]/catalog/option-groups-section.tsx",
  );
  const page = read(
    "src/app/merchant/[merchantId]/catalog/products/[productId]/page.tsx",
  );
  const selector = read(
    "src/app/merchant/[merchantId]/catalog/option-mode-selector.tsx",
  );
  const advanced = read(
    "src/app/merchant/[merchantId]/catalog/option-group-advanced-settings.tsx",
  );

  it("separates existing group, options, and create-new blocks", () => {
    expect(section).toContain("Configurar");
    expect(section).toContain("Opciones");
    expect(section).toContain("+ Agregar variantes o extras");
    expect(section).toContain("merchant-workspace-disclosure");
    expect(section).not.toContain("GRUPO DE OPCIONES");
    expect(section).not.toContain("Grupo de opciones");
  });

  it("uses merchant-friendly mode labels instead of enum names", () => {
    expect(selector).toContain("Elegir una");
    expect(selector).toContain("Permitir varias");
    expect(selector).toContain("Combinar unidades");
    expect(selector).toContain("value={mode.internalMode}");
    expect(selector).toContain("SINGLE");
    expect(selector).toContain("MULTIPLE");
    expect(selector).toContain("QUANTITY");
    expect(selector).toContain("getMerchantOptionModeCopy");
    expect(selector).not.toContain("Una opción (SINGLE)");
    expect(section).not.toContain("Modo de selección");
  });

  it("hides min/max behind advanced settings", () => {
    expect(advanced).toContain("Configuración avanzada");
    expect(section).toContain("OptionGroupAdvancedSettings");
  });

  it("shows quantity explanation for merchants", () => {
    expect(selector).toContain("QuantityModePreview");
    expect(selector).toContain("docena de empanadas");
    expect(selector).toContain("Ver ejemplo");
  });

  it("uses explicit labels for option fields", () => {
    expect(section).toContain('name="name"');
    expect(section).toContain('name="priceDeltaInput"');
    expect(section).toContain("Agregar opción");
    expect(section).toContain("Guardar grupo");
  });

  it("shows option summaries for existing choices", () => {
    expect(section).toContain("formatOptionChoiceLine");
  });

  it("uses progressive disclosure instead of step-by-step workflow copy", () => {
    expect(section).toContain("Variantes y extras");
    expect(section).toContain(
      "Configurá tamaños, sabores, agregados o combinaciones.",
    );
    expect(section).not.toContain("Paso 1:");
    expect(section).not.toContain("Paso 2:");
    expect(section).not.toContain("Paso 3:");
  });

  it("edit product page uses Product / Variantes views", () => {
    expect(page).toContain('query.view === "options"');
    expect(page).toContain("?view=options");
    expect(page).toContain("Producto");
    expect(page).toContain("Variantes y extras");
    expect(page).toContain('aria-current={showOptions ? "page" : undefined}');
    expect(page).toContain('aria-current={showOptions ? undefined : "page"}');
    expect(page).toContain("OptionGroupsSection");
    expect(page).toContain("showOptions ? (");
    expect(page).toContain("merchant-workspace-edit-layout");
    expect(page).toContain("Información del producto");
    expect(page).not.toContain("Nuevo grupo");
  });
});

describe("option mode presentation for merchants", () => {
  const presentation = read("src/lib/option-mode-presentation.ts");
  const options = read("src/application/catalog/options.ts");

  it("centralizes friendly labels", () => {
    expect(presentation).toContain("getOptionModePresentation");
    expect(presentation).toContain("defaultBoundsForNewOptionGroup");
  });

  it("applies new SINGLE defaults only on create path", () => {
    expect(options).toContain("defaultBoundsForNewOptionGroup");
    expect(presentation).toContain("minSelections: 1");
    expect(presentation).toContain("maxSelections: 1");
  });
});
