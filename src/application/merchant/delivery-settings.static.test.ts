import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("merchant delivery settings static checks", () => {
  it("uses requireMerchantRole OWNER|STAFF and does not bypass via admin secret", () => {
    const wiring = read("src/application/merchant/delivery-wiring.ts");
    expect(wiring).toContain('import "server-only"');
    expect(wiring).toContain("requireMerchantRole");
    expect(wiring).toContain("DELIVERY_SETTINGS_ALLOWED_ROLES");
    const useCase = read("src/application/merchant/delivery-settings.ts");
    expect(useCase).toContain('["OWNER", "STAFF"]');
    expect(wiring).not.toContain("createSupabaseAdminClient");
    expect(wiring).not.toContain("SUPABASE_SECRET_KEY");
    expect(wiring).not.toContain("requirePlatformAdmin");
  });

  it("does not add a delivery-settings migration", () => {
    const drizzleDir = path.join(root, "drizzle");
    const sqlFiles = fs
      .readdirSync(drizzleDir)
      .filter((file) => file.endsWith(".sql"));
    for (const file of sqlFiles) {
      expect(file.toLowerCase()).not.toContain("delivery_settings");
    }
    const schema = read("src/infrastructure/db/schema/merchant.ts");
    expect(schema).toContain("merchant_delivery_zones");
    expect(schema).toContain("merchant_delivery_enabled");
    expect(schema).toContain("merchant_delivery_zones_merchant_zone_uidx");
  });

  it("server action module exports only async functions", () => {
    const actions = read("src/app/merchant/[merchantId]/delivery/actions.ts");
    expect(actions.trimStart().startsWith('"use server"')).toBe(true);
    expect(actions).toMatch(
      /export async function saveMerchantDeliverySettingsAction/,
    );
    expect(actions).not.toMatch(/export const /);
  });

  it("does not expose platform delivery or create geographic zones", () => {
    const form = read(
      "src/app/merchant/[merchantId]/delivery/delivery-settings-form.tsx",
    );
    const page = read("src/app/merchant/[merchantId]/delivery/page.tsx");
    const useCase = read("src/application/merchant/delivery-settings.ts");
    expect(form).toContain("Ofrecer envío a domicilio");
    expect(form).toContain(
      "Los clientes podrán elegir entrega en las zonas que tengas activas.",
    );
    expect(form).toContain("merchant_delivery_enabled");
    expect(form).toContain("merchant-workspace-switch-input");
    expect(form).toContain("merchant-workspace-form-actions");
    expect(form).toContain("Guardar cambios");
    expect(form).not.toContain("Realizo envíos con el comercio");
    expect(form).not.toContain("platform_delivery");
    expect(form).not.toContain("PLATFORM_DELIVERY");
    expect(form).not.toContain("Delivery de la plataforma");
    expect(form).not.toContain("alert(");
    expect(page).toContain("Envíos");
    expect(page).toContain('activeSection="settings"');
    expect(page).toContain("MerchantSettingsNav");
    expect(useCase).not.toContain("insertZone");
    expect(useCase).not.toContain("insertCity");
  });

  it("parses money with existing helpers and persists integer cents", () => {
    const useCase = read("src/application/merchant/delivery-settings.ts");
    const repo = read(
      "src/infrastructure/db/repositories/merchant-delivery-repository.ts",
    );
    expect(useCase).toContain("parseMoneyInputToCents");
    expect(repo).toContain("moneyCents");
    expect(repo).toContain("db.transaction");
    expect(repo).not.toContain("platformDeliveryEnabled");
    expect(repo).not.toContain("pickupEnabled");
  });
});
