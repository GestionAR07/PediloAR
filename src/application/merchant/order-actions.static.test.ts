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
    expect(actions).toContain(
      "export async function startPreparingMerchantOrderAction",
    );
    expect(actions).toContain(
      "export async function markMerchantOrderReadyAction",
    );
    expect(actions).toContain(
      "export async function completeMerchantPickupOrderAction",
    );
    expect(actions).toContain(
      "export async function startMerchantDeliveryAction",
    );
    expect(actions).toContain(
      "export async function completeMerchantDeliveryAction",
    );
    expect(actions).toContain('revalidatePath("/merchant")');
    expect(actions).toContain("revalidatePath(`/merchant/${merchantId}`)");
    expect(actions).toContain(
      "revalidatePath(`/merchant/${merchantId}/orders/${orderId}`)",
    );
    expect(actions).not.toMatch(/export const /);
    expect(actions).not.toContain("alert(");
    expect(actions).not.toContain("fromStatus");
    expect(actions).not.toContain("targetStatus");
    expect(actions).not.toContain("actorUserId");
    expect(actions).not.toContain("fulfillmentMethod");
  });

  it("shows PENDING-only accept/reject and no later lifecycle CTAs", () => {
    const card = read("src/components/merchant/merchant-order-card.tsx");
    const detail = read("src/components/merchant/merchant-order-detail.tsx");
    const actions = read(
      "src/components/merchant/merchant-pending-order-actions.tsx",
    );
    expect(card).toContain("MerchantOrderLifecycleActions");
    expect(detail).toContain("MerchantOrderLifecycleActions");
    expect(card).not.toContain("MerchantPendingOrderActions");
    expect(detail).not.toContain("MerchantPendingOrderActions");
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

  it("prepares and marks ready via the operational core", () => {
    const useCase = read("src/application/merchant/order-actions.ts");
    const wiring = read("src/application/merchant/order-actions-wiring.ts");
    expect(useCase).toContain("startPreparingMerchantOrder");
    expect(useCase).toContain('targetStatus: "PREPARING"');
    expect(useCase).toContain("markMerchantOrderReady");
    expect(useCase).toContain('targetStatus: "READY"');
    expect(useCase).toContain("transitionMerchantOperationalOrder");
    expect(wiring).toContain("startPreparingMerchantOrderApp");
    expect(wiring).toContain("markMerchantOrderReadyApp");
    expect(wiring).toContain("requireMerchantRole");
  });

  it("completes PICKUP via a specialized transaction, not the operational core", () => {
    const useCase = read("src/application/merchant/order-actions.ts");
    const repo = read(
      "src/infrastructure/db/repositories/merchant-order-completion-repository.ts",
    );
    expect(useCase).toContain("completeMerchantPickupOrder");
    expect(useCase).toContain("completeMerchantPickupOrderInTransaction");
    expect(useCase).not.toContain('targetStatus: "COMPLETED"');
    expect(repo).toContain("canCompleteOrder");
    expect(repo).toContain("assertOrderDeliveryCompatibility");
    expect(repo).toContain("transitionOrderStatus");
    expect(repo).toContain('.for("update")');
    expect(repo).toContain("eq(orders.merchantId, command.merchantId)");
    expect(repo).toContain("toStatus: next.value");
    expect(repo).toContain('actorType: "MERCHANT_USER"');
    expect(repo).not.toContain("transitionMerchantOperationalOrder");
    expect(repo).not.toContain("products");
    expect(repo).not.toContain("stockQuantity");
    expect(repo).not.toContain("tx.insert(deliveries)");
    expect(repo).not.toContain(".update(deliveries)");
    expect(repo).not.toContain("IN_TRANSIT");
  });

  it("shows contextual pickup CTAs and merchant delivery progression", () => {
    const lifecycle = read(
      "src/components/merchant/merchant-order-lifecycle-actions.tsx",
    );
    const card = read("src/components/merchant/merchant-order-card.tsx");
    const detail = read("src/components/merchant/merchant-order-detail.tsx");
    expect(lifecycle).toContain("MerchantPendingOrderActions");
    expect(lifecycle).toContain('status === "PENDING"');
    expect(lifecycle).toContain('status === "ACCEPTED"');
    expect(lifecycle).toContain("Comenzar preparación");
    expect(lifecycle).toContain("Comenzando...");
    expect(lifecycle).toContain("Marcar listo");
    expect(lifecycle).toContain("Marcar retirado");
    expect(lifecycle).toContain('fulfillmentMethod === "PICKUP"');
    expect(lifecycle).toContain('fulfillmentMethod === "MERCHANT_DELIVERY"');
    expect(lifecycle).toContain('deliveryStatus === "PENDING"');
    expect(lifecycle).toContain('deliveryStatus === "IN_TRANSIT"');
    expect(lifecycle).toContain("Marcar en camino");
    expect(lifecycle).toContain("Marcar entregado");
    expect(lifecycle).toContain("startMerchantDeliveryAction");
    expect(lifecycle).toContain("completeMerchantDeliveryAction");
    expect(lifecycle).toContain("startPreparingMerchantOrderAction");
    expect(lifecycle).toContain("markMerchantOrderReadyAction");
    expect(lifecycle).toContain("completeMerchantPickupOrderAction");
    expect(lifecycle).toContain("min-h-11");
    expect(lifecycle).toContain("pedilo-action-primary");
    expect(lifecycle).toContain("pedilo-action-success");
    expect(lifecycle).toContain('tone="success"');
    expect(lifecycle).toContain("aria-busy");
    expect(lifecycle).toContain('role="alert"');
    expect(lifecycle).not.toContain("Listo para iniciar el envío.");
    expect(lifecycle).not.toContain("Aceptar");
    expect(lifecycle).not.toContain("Rechazar");
    expect(lifecycle).not.toContain("alert(");
    expect(lifecycle).not.toContain("COLLECTED");
    expect(lifecycle).not.toContain("PLATFORM");
    expect(card).toContain("order.delivery?.status");
    expect(detail).toContain("order.delivery?.status");
  });

  it("progresses MERCHANT delivery via specialized transactions, not pickup or operational core", () => {
    const useCase = read("src/application/merchant/order-actions.ts");
    const wiring = read("src/application/merchant/order-actions-wiring.ts");
    const repo = read(
      "src/infrastructure/db/repositories/merchant-order-delivery-repository.ts",
    );
    expect(useCase).toContain("startMerchantDelivery");
    expect(useCase).toContain("completeMerchantDelivery");
    expect(useCase).toContain("startMerchantDeliveryInTransaction");
    expect(useCase).toContain("completeMerchantDeliveryInTransaction");
    expect(wiring).toContain("startMerchantDeliveryApp");
    expect(wiring).toContain("completeMerchantDeliveryApp");
    expect(wiring).toContain("requireMerchantRole");
    expect(repo).toContain("transitionDeliveryStatus");
    expect(repo).toContain("transitionOrderStatus");
    expect(repo).toContain("canCompleteOrder");
    expect(repo).toContain("deliveryCompletionImpliesOrderReadyToComplete");
    expect(repo).toContain("assertFulfillmentAllowedForMvp");
    expect(repo).toContain('.for("update")');
    expect(repo).toContain("eq(orders.merchantId, command.merchantId)");
    expect(repo).toContain('actorType: "MERCHANT_USER"');
    expect(repo).not.toContain("transitionMerchantOperationalOrder");
    expect(repo).not.toContain("products");
    expect(repo).not.toContain("stockQuantity");
    expect(repo).not.toContain("tx.insert(deliveries)");
    expect(repo).not.toContain("completeMerchantPickupOrder");
    expect(repo).toContain('"IN_TRANSIT"');
    expect(repo).toContain('"DELIVERED"');
  });
});
