import { describe, expect, it } from "vitest";
import { canCompleteOrder } from "./completion";

describe("order completion policy", () => {
  it("PICKUP may complete from READY without Delivery", () => {
    const result = canCompleteOrder({
      orderStatus: "READY",
      fulfillmentMethod: "PICKUP",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects completion when not READY", () => {
    const result = canCompleteOrder({
      orderStatus: "PREPARING",
      fulfillmentMethod: "PICKUP",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ORDER_COMPLETE_NOT_READY");
    }
  });

  it("MERCHANT_DELIVERY requires Delivery DELIVERED", () => {
    const missing = canCompleteOrder({
      orderStatus: "READY",
      fulfillmentMethod: "MERCHANT_DELIVERY",
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.code).toBe("ORDER_COMPLETE_DELIVERY_REQUIRED");
    }

    const inTransit = canCompleteOrder({
      orderStatus: "READY",
      fulfillmentMethod: "MERCHANT_DELIVERY",
      delivery: { status: "IN_TRANSIT" },
    });
    expect(inTransit.ok).toBe(false);
    if (!inTransit.ok) {
      expect(inTransit.error.code).toBe(
        "ORDER_COMPLETE_DELIVERY_NOT_DELIVERED",
      );
    }

    const delivered = canCompleteOrder({
      orderStatus: "READY",
      fulfillmentMethod: "MERCHANT_DELIVERY",
      delivery: { status: "DELIVERED" },
    });
    expect(delivered.ok).toBe(true);
  });

  it("PLATFORM_DELIVERY requires Delivery DELIVERED", () => {
    const delivered = canCompleteOrder({
      orderStatus: "READY",
      fulfillmentMethod: "PLATFORM_DELIVERY",
      delivery: { status: "DELIVERED" },
    });
    expect(delivered.ok).toBe(true);

    const pending = canCompleteOrder({
      orderStatus: "READY",
      fulfillmentMethod: "PLATFORM_DELIVERY",
      delivery: { status: "PENDING" },
    });
    expect(pending.ok).toBe(false);
  });
});
