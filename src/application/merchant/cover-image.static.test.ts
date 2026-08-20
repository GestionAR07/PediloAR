import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("merchant cover image static checks", () => {
  it("migration adds cover_image_path and private merchant-images bucket", () => {
    const sql = read("drizzle/0006_uneven_patriot.sql");
    expect(sql).toContain('ADD COLUMN "cover_image_path" text');
    expect(sql).toContain("merchant-images");
    expect(sql).toContain("false");
    expect(sql).toContain("merchant_images_select_member");
    expect(sql).not.toMatch(
      /CREATE POLICY[\s\S]*merchant_images[\s\S]*FOR INSERT/i,
    );
    expect(sql).not.toMatch(
      /CREATE POLICY[\s\S]*merchant_images[\s\S]*FOR DELETE/i,
    );
  });

  it("uses a private merchant-images bucket and does not add client writes", () => {
    const lib = read("src/lib/merchant-cover-image.ts");
    expect(lib).toContain('MERCHANT_IMAGES_BUCKET = "merchant-images"');
    expect(lib).toContain("${input.merchantId}/cover/");
    expect(lib).toContain("validateProductImageFile");

    const storage = read("src/infrastructure/storage/merchant-images.ts");
    expect(storage).toContain('import "server-only"');
    expect(storage).toContain("createSupabaseAdminClient");
    expect(storage).toContain("randomUUID");
    expect(storage).not.toContain("NEXT_PUBLIC_SUPABASE_SECRET");
  });

  it("wiring requires OWNER or STAFF and never ships the service key", () => {
    const wiring = read("src/application/merchant/cover-image-wiring.ts");
    expect(wiring).toContain('import "server-only"');
    expect(wiring).toContain("requireMerchantRole");
    expect(wiring).toContain("MERCHANT_COVER_ALLOWED_ROLES");
    expect(wiring).not.toContain("requirePlatformAdmin");
    expect(wiring).not.toContain("SUPABASE_SECRET_KEY");

    const useCase = read("src/application/merchant/cover-image.ts");
    expect(useCase).toContain('["OWNER", "STAFF"]');
  });

  it("editor shows merchant-friendly cover copy", () => {
    const editor = read(
      "src/app/merchant/[merchantId]/profile/merchant-cover-editor.tsx",
    );
    expect(editor).toContain("Portada del comercio");
    expect(editor).toContain("MERCHANT_COVER_HELP_TEXT");
    expect(editor).toContain("Subir imagen");
    expect(editor).toContain("Cambiar imagen");
    expect(editor).toContain("Eliminar imagen");
    expect(editor).toContain("MerchantCoverFallback");
    expect(editor).not.toContain("bucket");
    expect(editor).not.toContain("bodySizeLimit");
  });

  it("server action validates the file before buffering bytes", () => {
    const actions = read("src/app/merchant/[merchantId]/profile/actions.ts");
    expect(actions).toContain("validateMerchantCoverFile");
    expect(actions).toContain("upsertMerchantCoverAction");
    const validationIdx = actions.indexOf("validateMerchantCoverFile");
    const bufferIdx = actions.indexOf("arrayBuffer");
    expect(validationIdx).toBeGreaterThan(-1);
    expect(bufferIdx).toBeGreaterThan(validationIdx);
  });

  it("public discovery resolves coverUrl on the server without raw paths", () => {
    const types = read("src/application/storefront/types.ts");
    expect(types).toMatch(
      /export type PublicMerchantCard = \{[\s\S]*categoryIds: string\[\];[\s\S]*coverUrl: string \| null;/,
    );
    expect(types).not.toContain("coverImagePath");
    expect(types).not.toContain("cover_image_path");

    const discovery = read("src/application/storefront/discovery.ts");
    expect(discovery).toContain("createCoverSignedUrls");
    expect(discovery).toContain("coverUrl:");

    const wiring = read("src/application/storefront/wiring.ts");
    expect(wiring).toContain("createMerchantCoverSignedUrls");
    expect(wiring).not.toContain("NEXT_PUBLIC_SUPABASE_SECRET");

    const card = read("src/components/storefront/merchant-card.tsx");
    expect(card).toContain("merchant.coverUrl");
    expect(card).toContain("MerchantCoverFallback");
    expect(card).toContain('loading="lazy"');
    expect(card).toContain("object-cover");
    expect(card).toContain("onError");
  });
});
