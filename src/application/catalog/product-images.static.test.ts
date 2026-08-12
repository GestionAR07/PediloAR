import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("product images storage static checks", () => {
  it("migration adds image_path and private product-images bucket", () => {
    const sql = read("drizzle/0003_needy_shocker.sql");
    expect(sql).toContain('ADD COLUMN "image_path" text');
    expect(sql).toContain("product-images");
    expect(sql).toContain("false");
    expect(sql).toContain("product_images_select_member");
    expect(sql).not.toMatch(
      /CREATE POLICY[\s\S]*product_images[\s\S]*FOR INSERT/i,
    );
    expect(sql).not.toMatch(
      /CREATE POLICY[\s\S]*product_images[\s\S]*FOR DELETE/i,
    );
  });

  it("wiring uses requireMerchantRole for image mutations", () => {
    const wiring = read("src/application/catalog/wiring.ts");
    expect(wiring).toContain("upsertProductImage");
    expect(wiring).toContain("deleteProductImage");
    expect(wiring).toContain("requireMerchantRole");
    expect(wiring).toContain("uploadProductImageObject");
  });

  it("editor shows merchant-friendly image copy", () => {
    const editor = read(
      "src/app/merchant/[merchantId]/catalog/product-image-editor.tsx",
    );
    expect(editor).toContain("Imagen del producto");
    expect(editor).toContain("PRODUCT_IMAGE_HELP_TEXT");
    expect(editor).toContain("Subir imagen");
    expect(editor).toContain("Eliminar imagen");
    expect(editor).not.toContain("bucket");
  });
});
