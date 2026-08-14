import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("merchant accept/reject static checks", () => {
  it("accepts via operational transition and rejects via cancelOrder", () => {
    const useCase = read("src/application/merchant/order-actions.ts");
    const wiring = read("src/application/merchant/order-actions-wiring.ts");
    expect(useCase).toContain("transitionMerchantOperationalOrder");
    expect(useCase).toContain('targetStatus: "ACCEPTED"');
    expect(useCase).toContain("cancelOrder");
    expect(useCase).toContain("expectedMerchantId");
    expect(useCase).toContain('expectedCurrentStatus: "PENDING"');
    expect(useCase).toContain("MERCHANT_UNAVAILABLE");
    expect(useCase).toContain("OUT_OF_STOCK");
    expect(useCase).not.toContain("CUSTOMER_REQUEST");
    expect(wiring).toContain('import "server-only"');
    expect(wiring).toContain("requireMerchantRole");
    expect(wiring).toContain("MERCHANT_ORDER_ALLOWED_ROLES");
    expect(wiring).not.toContain('"use server"');
  });

  it("hardens cancelOrderInTransaction with merchant scope inside FOR UPDATE", () => {
    const repo = read(
      "src/infrastructure/db/repositories/checkout-order-repository.ts",
    );
    expect(repo).toContain("expectedMerchantId");
    expect(repo).toContain("expectedCurrentStatus");
    expect(repo).toContain("eq(orders.merchantId, command.expectedMerchantId)");
    expect(repo).toContain('.for("update")');
    expect(repo).toContain("sql`${products.stockQuantity} + ${quantity}`");
  });

  it("exposes async Server Actions without extra value exports", () => {
    const actions = read("src/app/merchant/[merchantId]/orders/actions.ts");
    expect(actions.trimStart().startsWith('"use server"')).toBe(true);
    expect(actions).toContain(
      "export async function acceptMerchantOrderAction",
    );
    expect(actions).toContain(
      "export async function rejectMerchantOrderAction",
    );
    expect(actions).toContain('revalidatePath("/merchant")');
    expect(actions).toContain("revalidatePath(`/merchant/${merchantId}`)");
    expect(actions).toContain(
      "revalidatePath(`/merchant/${merchantId}/orders/${orderId}`)",
    );
    expect(actions).not.toMatch(/export const /);
    expect(actions).not.toContain("alert(");
  });

  it("shows PENDING-only accept/reject and no later lifecycle CTAs", () => {
    const card = read("src/components/merchant/merchant-order-card.tsx");
    const detail = read("src/components/merchant/merchant-order-detail.tsx");
    const actions = read(
      "src/components/merchant/merchant-pending-order-actions.tsx",
    );
    expect(card).toContain('order.status === "PENDING"');
    expect(detail).toContain('order.status === "PENDING"');
    expect(card).toContain("MerchantPendingOrderActions");
    expect(detail).toContain("MerchantPendingOrderActions");
    expect(actions).toContain("Aceptar");
    expect(actions).toContain("Rechazar");
    expect(actions).toContain("Aceptando...");
    expect(actions).toContain("Confirmar rechazo");
    expect(actions).toContain("Volver");
    expect(actions).toContain("<dialog");
    expect(actions).toContain('type="radio"');
    expect(actions).toContain("MERCHANT_UNAVAILABLE");
    expect(actions).not.toContain("CUSTOMER_REQUEST");
    expect(actions).not.toContain("Preparar");
    expect(actions).not.toContain("Marcar listo");
    expect(actions).not.toContain("Completar");
    expect(actions).not.toContain("En camino");
    expect(actions).not.toContain("alert(");
  });
});
