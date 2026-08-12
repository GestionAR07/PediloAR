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
    expect(section).toContain("Grupo de opciones");
    expect(section).toContain("Opciones de este grupo");
    expect(section).toContain("Crear nuevo grupo de opciones");
    expect(section).toContain("border-dashed");
  });

  it("uses merchant-friendly mode labels instead of enum names", () => {
    const presentation = read("src/lib/option-mode-presentation.ts");
    expect(presentation).toContain("Elegir una opción");
    expect(presentation).toContain("Elegir varias");
    expect(presentation).toContain("Variedades por unidad");
    expect(selector).toContain("{mode.label}");
    expect(selector).not.toContain("Una opción (SINGLE)");
    expect(section).not.toContain("Modo de selección");
  });

  it("hides min/max behind advanced settings", () => {
    expect(advanced).toContain("Configuración avanzada");
    expect(section).toContain("OptionGroupAdvancedSettings");
    expect(section).not.toMatch(
      /<span>Mínimo<\/span>[\s\S]*Configuración del grupo/,
    );
  });

  it("shows quantity explanation for merchants", () => {
    expect(selector).toContain("QuantityModePreview");
    expect(selector).toContain("docena de empanadas");
  });

  it("uses explicit labels for option fields", () => {
    expect(section).toContain("Nombre del grupo");
    expect(section).toContain("Nombre de la opción");
    expect(section).toContain("Precio adicional (ARS)");
    expect(section).toContain("Agregar opción");
    expect(section).toContain("Guardar grupo");
  });

  it("shows option summaries for existing choices", () => {
    expect(section).toContain("formatOptionChoiceLine");
  });

  it("documents the step-by-step workflow", () => {
    expect(section).toContain("Paso 1:");
    expect(section).toContain("Paso 2:");
    expect(section).toContain("Paso 3:");
  });

  it("edit product page delegates to OptionGroupsSection", () => {
    expect(page).toContain("OptionGroupsSection");
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
