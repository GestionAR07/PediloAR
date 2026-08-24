import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("merchant payment method settings static checks", () => {
  it("uses requireMerchantRole OWNER|STAFF and does not bypass via admin secret", () => {
    const wiring = read("src/application/merchant/payment-method-wiring.ts");
    expect(wiring).toContain('import "server-only"');
    expect(wiring).toContain("requireMerchantRole");
    expect(wiring).toContain("PAYMENT_METHOD_ALLOWED_ROLES");
    const useCase = read("src/application/merchant/payment-methods.ts");
    expect(useCase).toContain('["OWNER", "STAFF"]');
    expect(wiring).not.toContain("createSupabaseAdminClient");
    expect(wiring).not.toContain("SUPABASE_SECRET_KEY");
  });

  it("does not add a payment-method migration", () => {
    const drizzleDir = path.join(root, "drizzle");
    const sqlFiles = fs
      .readdirSync(drizzleDir)
      .filter((file) => file.endsWith(".sql"));
    for (const file of sqlFiles) {
      expect(file.toLowerCase()).not.toContain("payment_method_settings");
    }
    const schema = read("src/infrastructure/db/schema/merchant.ts");
    expect(schema).toContain("merchant_payment_methods");
    expect(schema).toContain("PAYMENT_METHOD_CODE_VALUES");
    const enums = read("src/infrastructure/db/schema/enums.ts");
    expect(enums).toContain('"CASH"');
    expect(enums).toContain('"TRANSFER"');
    expect(enums).toContain('"MERCADO_PAGO"');
  });

  it("server action module exports only async functions", () => {
    const actions = read(
      "src/app/merchant/[merchantId]/payment-methods/actions.ts",
    );
    expect(actions.trimStart().startsWith('"use server"')).toBe(true);
    expect(actions).toMatch(
      /export async function saveMerchantPaymentMethodsAction/,
    );
    expect(actions).not.toMatch(/export const /);
  });

  it("preserves payment field names with conditional instructions presentation", () => {
    const form = read(
      "src/app/merchant/[merchantId]/payment-methods/payment-methods-form.tsx",
    );
    expect(form).toContain("useActionState");
    expect(form).toContain("saveMerchantPaymentMethodsAction");
    expect(form).toContain("name={`active_${method.code}`}");
    expect(form).toContain("defaultChecked={method.active}");
    expect(form).toContain("name={`instructions_${method.code}`}");
    expect(form).toContain("defaultValue={method.instructions}");
    expect(form).toContain("merchant-workspace-payment-instructions");
    expect(form).toContain("merchant-workspace-payment-instructions-hint");
    expect(form).toContain("Activá este medio para agregar instrucciones.");
    expect(form).toContain("merchant-workspace-switch--compact");
    expect(form).toContain("merchant-workspace-switch-copy");
    expect(form).toMatch(
      /<label className="merchant-workspace-switch merchant-workspace-switch--compact">[\s\S]*merchant-workspace-switch-track[\s\S]*merchant-workspace-switch-copy/,
    );
    expect(form).toContain("merchant-workspace-switch-label-on");
    expect(form).toContain("Activo");
    expect(form).toContain("Activar");
    expect(form).toContain("Instrucciones para el cliente");
    expect(form).toContain("merchant-workspace-form-actions");
    expect(form).toContain("Guardar cambios");
    expect(form).not.toContain("merchant-workspace-active-pill");
    expect(form).not.toContain("merchant-workspace-switch--labeled");
  });
});
