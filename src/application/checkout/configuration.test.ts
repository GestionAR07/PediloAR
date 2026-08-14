import { describe, expect, it, vi } from "vitest";
import { getCheckoutConfiguration } from "./configuration";
import type {
  CheckoutDeliveryZoneRecord,
  CheckoutMerchantRecord,
  CheckoutPaymentMethodRecord,
  PrepareOrderDeps,
} from "./types";

const NOW = new Date("2026-08-13T12:00:00.000Z");
const MERCHANT_ID = "11111111-1111-4111-8111-111111111111";
const ZONE_HOME_ID = "44444444-4444-4444-8444-444444444444";
const ZONE_DELIVERY_ID = "55555555-5555-4555-8555-555555555555";
const ZONE_INACTIVE_ID = "66666666-6666-4666-8666-666666666666";

function merchant(
  overrides: Partial<CheckoutMerchantRecord> = {},
): CheckoutMerchantRecord {
  return {
    id: MERCHANT_ID,
    name: "Empanadas Rawson",
    status: "ACTIVE",
    cityId: "33333333-3333-4333-8333-333333333333",
    cityName: "Rawson",
    zoneId: ZONE_HOME_ID,
    zoneName: "Centro",
    pickupEnabled: true,
    merchantDeliveryEnabled: true,
    platformDeliveryEnabled: true,
    acceptingOrders: true,
    pausedUntil: null,
    preparationMinutes: 25,
    ...overrides,
  };
}

function payments(): CheckoutPaymentMethodRecord[] {
  return [
    {
      code: "CASH",
      label: "Efectivo",
      instructions: "Pagar al recibir",
      active: true,
    },
    {
      code: "TRANSFER",
      label: "Transferencia",
      instructions: "Alias secreto",
      active: false,
    },
    {
      code: "MERCADO_PAGO",
      label: "Mercado Pago",
      instructions: "Alias MP",
      active: true,
    },
  ];
}

function zones(): CheckoutDeliveryZoneRecord[] {
  return [
    {
      merchantId: MERCHANT_ID,
      zoneId: ZONE_DELIVERY_ID,
      zoneName: "Barrio Norte",
      cityId: "33333333-3333-4333-8333-333333333333",
      cityName: "Rawson",
      deliveryFeeCents: 15000,
      minimumOrderCents: 100000,
      estimatedMinutes: 40,
      active: true,
    },
    {
      merchantId: MERCHANT_ID,
      zoneId: ZONE_INACTIVE_ID,
      zoneName: "Inactiva",
      cityId: "33333333-3333-4333-8333-333333333333",
      cityName: "Rawson",
      deliveryFeeCents: 1,
      minimumOrderCents: 1,
      estimatedMinutes: 1,
      active: false,
    },
  ];
}

function deps(
  overrides: Partial<PrepareOrderDeps> = {},
): Pick<
  PrepareOrderDeps,
  | "now"
  | "findMerchantById"
  | "listPaymentMethodsForMerchant"
  | "listDeliveryZonesForMerchant"
> {
  return {
    now: () => NOW,
    findMerchantById: vi.fn(async () => merchant()),
    listPaymentMethodsForMerchant: vi.fn(async () => payments()),
    listDeliveryZonesForMerchant: vi.fn(async () => zones()),
    ...overrides,
  };
}

describe("getCheckoutConfiguration", () => {
  it("returns a safe public DTO", async () => {
    const result = await getCheckoutConfiguration(MERCHANT_ID, deps());
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.merchant).toEqual({
      id: MERCHANT_ID,
      name: "Empanadas Rawson",
      acceptingOrders: true,
      availabilityLabel: "Disponible",
      availabilityTone: "available",
      pickupEnabled: true,
      merchantDeliveryEnabled: true,
      homeZoneId: ZONE_HOME_ID,
      homeZoneName: "Centro",
      homeCityName: "Rawson",
      preparationMinutes: 25,
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("platformDelivery");
    expect(serialized).not.toContain("membership");
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("DATABASE");
    expect(serialized).not.toContain("service-role");
    expect(serialized).not.toContain("pausedUntil");
    expect(serialized).not.toContain("credentials");
  });

  it("does not expose inactive payment methods", async () => {
    const result = await getCheckoutConfiguration(MERCHANT_ID, deps());
    expect(result?.paymentMethods.map((method) => method.code)).toEqual([
      "CASH",
      "MERCADO_PAGO",
    ]);
    expect(
      result?.paymentMethods.some((method) => method.code === "TRANSFER"),
    ).toBe(false);
  });

  it("exposes active methods with code, label and instructions", async () => {
    const result = await getCheckoutConfiguration(MERCHANT_ID, deps());
    expect(result?.paymentMethods).toEqual([
      {
        code: "CASH",
        label: "Efectivo",
        instructions: "Pagar al recibir",
      },
      {
        code: "MERCADO_PAGO",
        label: "Mercado Pago",
        instructions: "Alias MP",
      },
    ]);
  });

  it("exposes only active delivery zones with fee and minimum", async () => {
    const result = await getCheckoutConfiguration(MERCHANT_ID, deps());
    expect(result?.deliveryZones).toEqual([
      {
        zoneId: ZONE_DELIVERY_ID,
        zoneName: "Barrio Norte",
        cityName: "Rawson",
        feeCents: 15000,
        minimumOrderCents: 100000,
        estimatedMinutes: 40,
      },
    ]);
  });

  it("does not load delivery zones when merchant delivery is disabled", async () => {
    const loaded = deps({
      findMerchantById: vi.fn(async () =>
        merchant({ merchantDeliveryEnabled: false }),
      ),
    });
    const result = await getCheckoutConfiguration(MERCHANT_ID, loaded);
    expect(result?.merchant.merchantDeliveryEnabled).toBe(false);
    expect(result?.merchant.pickupEnabled).toBe(true);
    expect(result?.deliveryZones).toEqual([]);
    expect(loaded.listDeliveryZonesForMerchant).not.toHaveBeenCalled();
  });

  it("returns null for an invalid merchant id", async () => {
    expect(await getCheckoutConfiguration("not-a-uuid", deps())).toBeNull();
  });
});
