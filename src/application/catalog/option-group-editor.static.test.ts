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

  it("separates existing group, options, and create-new blocks", () => {
    expect(section).toContain("Grupo de opciones");
    expect(section).toContain("Opciones de este grupo");
    expect(section).toContain("Crear nuevo grupo de opciones");
    expect(section).toContain("border-dashed");
  });

  it("uses explicit labels for group and option fields", () => {
    expect(section).toContain("Nombre del grupo");
    expect(section).toContain("Modo de selección");
    expect(section).toContain("Mínimo");
    expect(section).toContain("Máximo");
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
