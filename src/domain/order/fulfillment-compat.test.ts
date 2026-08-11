import { describe, expect, it } from "vitest";
import { assertOrderDeliveryCompatibility } from "./fulfillment-compat";

describe("assertOrderDeliveryCompatibility", () => {
  it("PICKUP forbids Delivery", () => {
    expect(
      assertOrderDeliveryCompatibility({ fulfillmentMethod: "PICKUP" }).ok,
    ).toBe(true);

    const withDelivery = assertOrderDeliveryCompatibility(
      { fulfillmentMethod: "PICKUP" },
      { provider: "MERCHANT" },
    );
    expect(withDelivery.ok).toBe(false);
    if (!withDelivery.ok) {
      expect(withDelivery.error.code).toBe(
        "ORDER_DELIVERY_PICKUP_HAS_DELIVERY",
      );
    }
  });

  it("MERCHANT_DELIVERY allows absence and MERCHANT provider only", () => {
    expect(
      assertOrderDeliveryCompatibility({
        fulfillmentMethod: "MERCHANT_DELIVERY",
      }).ok,
    ).toBe(true);

    expect(
      assertOrderDeliveryCompatibility(
        { fulfillmentMethod: "MERCHANT_DELIVERY" },
        { provider: "MERCHANT" },
      ).ok,
    ).toBe(true);

    const platform = assertOrderDeliveryCompatibility(
      { fulfillmentMethod: "MERCHANT_DELIVERY" },
      { provider: "PLATFORM" },
    );
    expect(platform.ok).toBe(false);
    if (!platform.ok) {
      expect(platform.error.code).toBe("ORDER_DELIVERY_PROVIDER_MISMATCH");
    }
  });

  it("PLATFORM_DELIVERY requires PLATFORM provider when Delivery exists", () => {
    expect(
      assertOrderDeliveryCompatibility(
        { fulfillmentMethod: "PLATFORM_DELIVERY" },
        { provider: "PLATFORM" },
      ).ok,
    ).toBe(true);

    const merchant = assertOrderDeliveryCompatibility(
      { fulfillmentMethod: "PLATFORM_DELIVERY" },
      { provider: "MERCHANT" },
    );
    expect(merchant.ok).toBe(false);
    if (!merchant.ok) {
      expect(merchant.error.code).toBe("ORDER_DELIVERY_PROVIDER_MISMATCH");
    }
  });
});
