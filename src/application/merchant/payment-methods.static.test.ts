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
});
