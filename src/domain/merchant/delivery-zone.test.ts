import { describe, expect, it } from "vitest";
import { moneyCents } from "../money/money-cents";
import { resolveMerchantDeliveryForZone } from "./delivery-zone";
import type { MerchantDeliveryZone } from "./types";

const zone: MerchantDeliveryZone = {
  merchantId: "m1",
  zoneId: "z-centro",
  deliveryFeeCents: moneyCents(15000),
  minimumOrderCents: moneyCents(500000),
  estimatedMinutes: 40,
  active: true,
};

describe("resolveMerchantDeliveryForZone", () => {
  it("returns config for valid active zone at or above minimum", () => {
    const exact = resolveMerchantDeliveryForZone(
      { merchantDeliveryEnabled: true },
      [zone],
      "z-centro",
      moneyCents(500000),
    );
    expect(exact.ok).toBe(true);
    if (exact.ok) {
      expect(exact.value.deliveryFeeCents).toBe(15000);
      expect(exact.value.minimumOrderCents).toBe(500000);
      expect(exact.value.estimatedMinutes).toBe(40);
    }

    const above = resolveMerchantDeliveryForZone(
      { merchantDeliveryEnabled: true },
      [zone],
      "z-centro",
      moneyCents(500001),
    );
    expect(above.ok).toBe(true);
  });

  it("rejects when merchant delivery is disabled", () => {
    const result = resolveMerchantDeliveryForZone(
      { merchantDeliveryEnabled: false },
      [zone],
      "z-centro",
      moneyCents(600000),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MERCHANT_DELIVERY_DISABLED");
    }
  });

  it("rejects unknown zone", () => {
    const result = resolveMerchantDeliveryForZone(
      { merchantDeliveryEnabled: true },
      [zone],
      "z-other",
      moneyCents(600000),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MERCHANT_DELIVERY_ZONE_NOT_FOUND");
    }
  });

  it("rejects inactive zone", () => {
    const result = resolveMerchantDeliveryForZone(
      { merchantDeliveryEnabled: true },
      [{ ...zone, active: false }],
      "z-centro",
      moneyCents(600000),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MERCHANT_DELIVERY_ZONE_INACTIVE");
    }
  });

  it("rejects subtotal below minimum", () => {
    const result = resolveMerchantDeliveryForZone(
      { merchantDeliveryEnabled: true },
      [zone],
      "z-centro",
      moneyCents(499999),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MERCHANT_DELIVERY_BELOW_MINIMUM");
    }
  });
});
