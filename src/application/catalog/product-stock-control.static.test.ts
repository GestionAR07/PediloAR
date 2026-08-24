import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("product stock control presentation", () => {
  const component = read(
    "src/app/merchant/[merchantId]/catalog/product-stock-control.tsx",
  );
  const newPage = read(
    "src/app/merchant/[merchantId]/catalog/products/new/page.tsx",
  );
  const editPage = read(
    "src/app/merchant/[merchantId]/catalog/products/[productId]/page.tsx",
  );

  it("preserves stock field names and select values", () => {
    expect(component).toContain('name="stockMode"');
    expect(component).toContain('value="NOT_TRACKED"');
    expect(component).toContain('value="TRACKED"');
    expect(component).toContain('name="stockQuantity"');
    expect(component).toContain("No controlar stock");
    expect(component).toContain("Controlar unidades disponibles");
  });

  it("keeps quantity in the DOM and toggles visibility from stock mode", () => {
    expect(component).toContain("useState");
    expect(component).toContain(
      'setTracked(event.currentTarget.value === "TRACKED")',
    );
    expect(component).toContain("merchant-workspace-stock-tracked-fields");
    expect(component).toContain("hidden={!tracked}");
    expect(component).toContain("defaultValue={stockQuantityDefault}");
    expect(component).not.toMatch(/tracked\s*\?\s*[\s\S]*name="stockQuantity"/);
  });

  it("uses ProductStockControl in new and edit product forms", () => {
    expect(newPage).toContain("ProductStockControl");
    expect(editPage).toContain("ProductStockControl");
    expect(newPage).toContain("createProductAction");
    expect(editPage).toContain("updateProductAction");
  });

  it("preserves commercial state checkboxes and server field names", () => {
    for (const page of [newPage, editPage]) {
      expect(page).toContain('name="active"');
      expect(page).toContain('name="available"');
      expect(page).toContain('type="checkbox"');
      expect(page).toContain("Mostrar en la tienda");
      expect(page).toContain("Disponible para pedir");
      expect(page).toContain("Visible para tus clientes.");
      expect(page).toContain("Podés pausarlo temporalmente sin eliminarlo.");
      expect(page).toContain("merchant-workspace-check-row");
    }
    expect(newPage).not.toContain('type="hidden" name="available" value="on"');
  });
});
