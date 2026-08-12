import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("catalog product save feedback", () => {
  it("submit button exposes pending labels for create and edit", () => {
    const button = read(
      "src/app/merchant/[merchantId]/catalog/product-form-submit-button.tsx",
    );
    expect(button).toContain("Crear producto");
    expect(button).toContain("Creando...");
    expect(button).toContain("Guardar cambios");
    expect(button).toContain("Guardando...");
    expect(button).toContain("disabled={pending}");
  });

  it("feedback banner clears query param after display", () => {
    const feedback = read(
      "src/app/merchant/[merchantId]/catalog/product-save-feedback.tsx",
    );
    expect(feedback).toContain("router.replace(cleanPath");
    expect(feedback).toContain("productSaveFeedbackMessage");
  });

  it("create action only redirects after successful persist", () => {
    const actions = read("src/app/merchant/[merchantId]/catalog/actions.ts");
    const createBlock = actions.slice(
      actions.indexOf("export async function createProductAction"),
      actions.indexOf("export async function updateProductAction"),
    );
    expect(createBlock).toContain("if (!result.ok)");
    expect(createBlock).toContain("throw new Error");
    expect(createBlock.indexOf("if (!result.ok)")).toBeLessThan(
      createBlock.indexOf("redirect("),
    );
  });

  it("update action only redirects after successful persist", () => {
    const actions = read("src/app/merchant/[merchantId]/catalog/actions.ts");
    const updateBlock = actions.slice(
      actions.indexOf("export async function updateProductAction"),
      actions.indexOf("export async function toggleProductAvailabilityAction"),
    );
    expect(updateBlock).toContain("if (!result.ok)");
    expect(updateBlock).toContain("throw new Error");
    expect(updateBlock.indexOf("if (!result.ok)")).toBeLessThan(
      updateBlock.indexOf("redirect("),
    );
  });
});
