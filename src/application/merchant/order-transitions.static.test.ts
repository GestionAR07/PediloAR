import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("merchant order transition core static checks", () => {
  it("locks the merchant-scoped order and writes Order+Event in one transaction", () => {
    const repo = read(
      "src/infrastructure/db/repositories/merchant-order-transition-repository.ts",
    );
    expect(repo).toContain('import "server-only"');
    expect(repo).toContain("db.transaction");
    expect(repo).toContain('.for("update")');
    expect(repo).toContain("eq(orders.id, command.orderId)");
    expect(repo).toContain("eq(orders.merchantId, command.merchantId)");
    expect(repo).toContain(".update(orders)");
    expect(repo).toContain("tx.insert(orderEvents)");
    expect(repo).toContain('actorType: "MERCHANT_USER"');
    expect(repo).toContain("reason: null");
    expect(repo).toContain("assertMerchantOperationalTarget");
    expect(repo).toContain("decideMerchantOperationalTransition");
  });

  it("does not touch Delivery, stock, cancelOrder, or completion", () => {
    const repo = read(
      "src/infrastructure/db/repositories/merchant-order-transition-repository.ts",
    );
    const useCase = read("src/application/merchant/order-transitions.ts");
    expect(repo).not.toContain("deliveries");
    expect(repo).not.toContain("products");
    expect(repo).not.toContain("stockQuantity");
    expect(repo).not.toContain("cancelOrder");
    expect(repo).not.toContain("cancelOrderInTransaction");
    expect(repo).not.toContain('status: "CANCELED"');
    expect(repo).not.toContain('status: "COMPLETED"');
    expect(useCase).toContain("MERCHANT_OPERATIONAL_TARGETS");
    expect(useCase).toContain('"ACCEPTED"');
    expect(useCase).toContain('"PREPARING"');
    expect(useCase).toContain('"READY"');
    expect(useCase).toContain("ORDER_TRANSITION_CANCEL_FORBIDDEN");
    expect(useCase).toContain("ORDER_TRANSITION_COMPLETE_FORBIDDEN");
    expect(useCase).toContain("transitionOrderStatus");
    expect(useCase).not.toContain('"use server"');
    expect(repo).not.toContain('"use server"');
  });

  it("does not add a transition migration or expose Server Actions", () => {
    const drizzleDir = path.join(root, "drizzle");
    const sqlFiles = fs
      .readdirSync(drizzleDir)
      .filter((file) => file.endsWith(".sql"));
    for (const file of sqlFiles) {
      expect(file.toLowerCase()).not.toContain("merchant_order_transition");
    }
    const page = read("src/app/merchant/[merchantId]/page.tsx");
    const detail = read(
      "src/app/merchant/[merchantId]/orders/[orderId]/page.tsx",
    );
    const card = read("src/components/merchant/merchant-order-card.tsx");
    expect(page).not.toContain("transitionMerchantOperationalOrder");
    expect(detail).not.toContain("transitionMerchantOperationalOrder");
    expect(card).not.toContain("Aceptar");
    expect(page).not.toContain("acceptOrder");
  });

  it("leaves cancelOrderInTransaction as the only restocking cancel path", () => {
    const checkout = read(
      "src/infrastructure/db/repositories/checkout-order-repository.ts",
    );
    expect(checkout).toContain(
      "export async function cancelOrderInTransaction",
    );
    expect(checkout).toContain("sql`${products.stockQuantity} + ${quantity}`");
    expect(checkout).toContain('toStatus: "CANCELED"');
  });
});
