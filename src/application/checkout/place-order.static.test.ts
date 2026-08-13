import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("checkout order persistence static checks", () => {
  it("writes inside a transaction with conditional TRACKED stock decrement", () => {
    const repo = read(
      "src/infrastructure/db/repositories/checkout-order-repository.ts",
    );
    expect(repo).toContain("db.transaction");
    expect(repo).toContain('eq(products.stockMode, "TRACKED")');
    expect(repo).toContain("gte(products.stockQuantity, quantity)");
    expect(repo).toContain("isUniqueViolation");
    expect(repo).toContain("fromStatus: null");
    expect(repo).toContain('toStatus: "PENDING"');
    expect(repo).toContain("cancelOrderInTransaction");
    expect(repo).toContain('.for("update")');
    expect(repo).toContain("orderBy(asc(products.id))");
    expect(repo).toContain("sql`${products.stockQuantity} + ${quantity}`");
    expect(repo).not.toContain("db:push");
  });

  it("does not expose placeOrder as a public Server Action", () => {
    const wiring = read("src/application/checkout/wiring.ts");
    expect(wiring).toContain("placeOrderApp");
    expect(wiring).toContain("cancelOrderApp");
    expect(wiring).toContain("server-only");
    expect(wiring).not.toContain('"use server"');
  });
});
