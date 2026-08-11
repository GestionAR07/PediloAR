import { describe, expect, it } from "vitest";
import { canCancelOrder } from "./cancellation";
import type { OrderActorType, OrderStatus } from "./enums";

describe("order cancellation policy", () => {
  it("CUSTOMER may only cancel PENDING", () => {
    expect(
      canCancelOrder({ actor: "CUSTOMER", orderStatus: "PENDING" }).ok,
    ).toBe(true);

    for (const status of [
      "ACCEPTED",
      "PREPARING",
      "READY",
      "COMPLETED",
      "CANCELED",
    ] as OrderStatus[]) {
      const result = canCancelOrder({
        actor: "CUSTOMER",
        orderStatus: status,
      });
      expect(result.ok).toBe(false);
    }
  });

  it("MERCHANT_USER may cancel PENDING through READY", () => {
    for (const status of [
      "PENDING",
      "ACCEPTED",
      "PREPARING",
      "READY",
    ] as OrderStatus[]) {
      expect(
        canCancelOrder({ actor: "MERCHANT_USER", orderStatus: status }).ok,
      ).toBe(true);
    }

    for (const status of ["COMPLETED", "CANCELED"] as OrderStatus[]) {
      const result = canCancelOrder({
        actor: "MERCHANT_USER",
        orderStatus: status,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("ORDER_CANCEL_TERMINAL");
      }
    }
  });

  it("ADMIN may cancel any non-terminal status", () => {
    for (const status of [
      "PENDING",
      "ACCEPTED",
      "PREPARING",
      "READY",
    ] as OrderStatus[]) {
      expect(canCancelOrder({ actor: "ADMIN", orderStatus: status }).ok).toBe(
        true,
      );
    }

    expect(
      canCancelOrder({ actor: "ADMIN", orderStatus: "COMPLETED" }).ok,
    ).toBe(false);
    expect(canCancelOrder({ actor: "ADMIN", orderStatus: "CANCELED" }).ok).toBe(
      false,
    );
  });

  it("SYSTEM requires an explicit cancelReason", () => {
    const missing = canCancelOrder({
      actor: "SYSTEM",
      orderStatus: "PENDING",
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.code).toBe("ORDER_CANCEL_SYSTEM_REASON_REQUIRED");
    }

    const ok = canCancelOrder({
      actor: "SYSTEM",
      orderStatus: "ACCEPTED",
      cancelReason: "PAYMENT_ISSUE",
    });
    expect(ok.ok).toBe(true);
  });

  it("never allows cancel of COMPLETED or CANCELED", () => {
    const actors: OrderActorType[] = [
      "CUSTOMER",
      "MERCHANT_USER",
      "ADMIN",
      "SYSTEM",
    ];
    for (const actor of actors) {
      for (const status of ["COMPLETED", "CANCELED"] as OrderStatus[]) {
        const result = canCancelOrder({
          actor,
          orderStatus: status,
          cancelReason: "OTHER",
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe("ORDER_CANCEL_TERMINAL");
        }
      }
    }
  });

  it("blocks cancellation when Delivery is IN_TRANSIT", () => {
    const result = canCancelOrder({
      actor: "MERCHANT_USER",
      orderStatus: "READY",
      delivery: { status: "IN_TRANSIT" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ORDER_CANCEL_DELIVERY_IN_TRANSIT");
    }

    const adminBlocked = canCancelOrder({
      actor: "ADMIN",
      orderStatus: "READY",
      delivery: { status: "IN_TRANSIT" },
    });
    expect(adminBlocked.ok).toBe(false);

    const afterFailed = canCancelOrder({
      actor: "ADMIN",
      orderStatus: "READY",
      delivery: { status: "FAILED" },
    });
    expect(afterFailed.ok).toBe(true);

    const pendingDelivery = canCancelOrder({
      actor: "MERCHANT_USER",
      orderStatus: "ACCEPTED",
      delivery: { status: "PENDING" },
    });
    expect(pendingDelivery.ok).toBe(true);
  });
});
