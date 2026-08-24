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
    expect(editor).toContain("Imagen");
    expect(editor).toContain("PRODUCT_IMAGE_HELP_TEXT");
    expect(editor).toContain("Subir imagen");
    expect(editor).toContain("Eliminar imagen");
    expect(editor).not.toContain("bucket");
  });

  it("editor gates upload client-side before calling the Server Action", () => {
    const editor = read(
      "src/app/merchant/[merchantId]/catalog/product-image-editor.tsx",
    );
    expect(editor).toContain("gateProductImageBeforeUpload");
    expect(editor).toContain("upsertAction");
    expect(editor).toContain("catch");
    expect(editor).toContain("UNEXPECTED_ACTION_ERROR");
    // Must not surface transport/config internals to merchants.
    expect(editor).not.toContain("bodySizeLimit");
    expect(editor).not.toContain("stack");
  });

  it("Next Server Action body limit is above the 5 MB app image limit", () => {
    const config = read("next.config.ts");
    expect(config).toContain("serverActions");
    expect(config).toContain('bodySizeLimit: "7mb"');
    expect(config).toMatch(/experimental\s*:\s*\{[\s\S]*serverActions/);

    const lib = read("src/lib/product-image.ts");
    expect(lib).toContain("PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024");
  });

  it("server action validates image before buffering bytes", () => {
    const actions = read("src/app/merchant/[merchantId]/catalog/actions.ts");
    expect(actions).toContain("validateProductImageFile");
    expect(actions).toContain("upsertProductImageAction");
    const validationIdx = actions.indexOf("validateProductImageFile");
    const bufferIdx = actions.indexOf("arrayBuffer");
    expect(validationIdx).toBeGreaterThan(-1);
    expect(bufferIdx).toBeGreaterThan(validationIdx);
  });
});
