import { describe, expect, it, vi } from "vitest";
import { AuthzError } from "@/server/auth/errors";
import { getCheckoutConfiguration } from "@/application/checkout/configuration";
import type {
  CheckoutDeliveryZoneRecord,
  CheckoutMerchantRecord,
} from "@/application/checkout/types";
import {
  listMerchantDeliverySettings,
  presentDeliverySettings,
  saveMerchantDeliverySettings,
  type ConfigurableCityZone,
  type DeliverySettingsWriteDeps,
  type MerchantDeliveryContext,
  type MerchantDeliveryZoneRow,
  type SaveDeliveryZoneInput,
  type SaveMerchantDeliverySettingsInput,
} from "./delivery-settings";

const MERCHANT_A = "11111111-1111-4111-8111-111111111111";
const MERCHANT_B = "22222222-2222-4222-8222-222222222222";
const CITY_ID = "33333333-3333-4333-8333-333333333333";
const ZONE_RAWSON = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ZONE_PLAYA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ZONE_FOREIGN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const CITY_ZONES: ConfigurableCityZone[] = [
  { id: ZONE_RAWSON, name: "Rawson", cityName: "Rawson" },
  { id: ZONE_PLAYA, name: "Playa Unión", cityName: "Rawson" },
];

function merchantContext(
  id: string,
  overrides: Partial<MerchantDeliveryContext> = {},
): MerchantDeliveryContext {
  return {
    id,
    cityId: CITY_ID,
    cityName: "Rawson",
    pickupEnabled: true,
    merchantDeliveryEnabled: false,
    ...overrides,
  };
}

function blankZone(zoneId: string): SaveDeliveryZoneInput {
  return {
    zoneId,
    active: false,
    feeInput: "",
    minimumInput: "",
    estimatedMinutesInput: "",
  };
}

function rawsonActive(): SaveDeliveryZoneInput {
  return {
    zoneId: ZONE_RAWSON,
    active: true,
    feeInput: "$1.500,00",
    minimumInput: "$2.000,00",
    estimatedMinutesInput: "30",
  };
}

function playaActive(): SaveDeliveryZoneInput {
  return {
    zoneId: ZONE_PLAYA,
    active: true,
    feeInput: "$800,00",
    minimumInput: "0",
    estimatedMinutesInput: "45",
  };
}

function emptyInput(
  overrides: Partial<SaveMerchantDeliverySettingsInput> = {},
): SaveMerchantDeliverySettingsInput {
  return {
    merchantDeliveryEnabled: false,
    zones: [blankZone(ZONE_RAWSON), blankZone(ZONE_PLAYA)],
    ...overrides,
  };
}

function memoryStore(): {
  merchants: Map<string, MerchantDeliveryContext>;
  rowsByMerchant: Map<string, MerchantDeliveryZoneRow[]>;
  deps: DeliverySettingsWriteDeps;
} {
  const merchants = new Map<string, MerchantDeliveryContext>([
    [MERCHANT_A, merchantContext(MERCHANT_A)],
    [MERCHANT_B, merchantContext(MERCHANT_B)],
  ]);
  const rowsByMerchant = new Map<string, MerchantDeliveryZoneRow[]>([
    [MERCHANT_A, []],
    [MERCHANT_B, []],
  ]);

  const deps: DeliverySettingsWriteDeps = {
    requireDeliveryAccess: vi.fn(async () => undefined),
    findMerchant: vi.fn(
      async (merchantId) => merchants.get(merchantId) ?? null,
    ),
    listZonesForCity: vi.fn(async () => [...CITY_ZONES]),
    listDeliveryZones: vi.fn(async (merchantId) => [
      ...(rowsByMerchant.get(merchantId) ?? []),
    ]),
    saveDeliverySettings: vi.fn(
      async (
        merchantId: string,
        input: Parameters<DeliverySettingsWriteDeps["saveDeliverySettings"]>[1],
      ) => {
        const merchant = merchants.get(merchantId);
        if (merchant) {
          merchants.set(merchantId, {
            ...merchant,
            merchantDeliveryEnabled: input.merchantDeliveryEnabled,
          });
        }
        const current = rowsByMerchant.get(merchantId) ?? [];
        const untouched = current.filter(
          (row) => !input.zones.some((zone) => zone.zoneId === row.zoneId),
        );
        const upserted: MerchantDeliveryZoneRow[] = input.zones.map((zone) => {
          const city = CITY_ZONES.find((item) => item.id === zone.zoneId);
          return {
            zoneId: zone.zoneId,
            zoneName: city?.name ?? zone.zoneId,
            cityName: city?.cityName ?? "Rawson",
            deliveryFeeCents: zone.deliveryFeeCents,
            minimumOrderCents: zone.minimumOrderCents,
            estimatedMinutes: zone.estimatedMinutes,
            active: zone.active,
          };
        });
        const next = [...untouched, ...upserted];
        rowsByMerchant.set(merchantId, next);
        return [...next];
      },
    ),
  };

  return { merchants, rowsByMerchant, deps };
}

function checkoutMerchant(
  context: MerchantDeliveryContext,
): CheckoutMerchantRecord {
  return {
    id: context.id,
    name: "Comercio Prueba",
    status: "ACTIVE",
    cityId: context.cityId,
    cityName: context.cityName,
    zoneId: ZONE_RAWSON,
    zoneName: "Rawson",
    pickupEnabled: context.pickupEnabled,
    merchantDeliveryEnabled: context.merchantDeliveryEnabled,
    platformDeliveryEnabled: false,
    acceptingOrders: true,
    pausedUntil: null,
    preparationMinutes: 25,
  };
}

function toCheckoutZones(
  merchantId: string,
  rows: readonly MerchantDeliveryZoneRow[],
): CheckoutDeliveryZoneRecord[] {
  return rows.map((row) => ({
    merchantId,
    zoneId: row.zoneId,
    zoneName: row.zoneName,
    cityId: CITY_ID,
    cityName: row.cityName,
    deliveryFeeCents: row.deliveryFeeCents,
    minimumOrderCents: row.minimumOrderCents,
    estimatedMinutes: row.estimatedMinutes,
    active: row.active,
  }));
}

describe("presentDeliverySettings", () => {
  it("shows city zones with empty config when the merchant has no rows", () => {
    const view = presentDeliverySettings({
      merchant: merchantContext(MERCHANT_A),
      cityZones: CITY_ZONES,
      rows: [],
    });
    expect(view.merchantDeliveryEnabled).toBe(false);
    expect(view.pickupEnabled).toBe(true);
    expect(view.zones.map((zone) => zone.zoneName)).toEqual([
      "Playa Unión",
      "Rawson",
    ]);
    expect(view.zones.every((zone) => zone.configured === false)).toBe(true);
    expect(view.zones.every((zone) => zone.active === false)).toBe(true);
    expect(view.zones.every((zone) => zone.deliveryFeeCents === null)).toBe(
      true,
    );
  });
});

describe("saveMerchantDeliverySettings", () => {
  it("does not create zone rows when delivery stays disabled and zones are blank", async () => {
    const { deps, rowsByMerchant } = memoryStore();
    const result = await saveMerchantDeliverySettings(
      MERCHANT_A,
      emptyInput(),
      deps,
    );
    expect(result.ok).toBe(true);
    expect(rowsByMerchant.get(MERCHANT_A)).toEqual([]);
    expect(deps.saveDeliverySettings).toHaveBeenCalledWith(MERCHANT_A, {
      merchantDeliveryEnabled: false,
      zones: [],
    });
  });

  it("enables merchant delivery without inventing zone rows", async () => {
    const { deps, merchants } = memoryStore();
    const result = await saveMerchantDeliverySettings(
      MERCHANT_A,
      emptyInput({ merchantDeliveryEnabled: true }),
      deps,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.merchantDeliveryEnabled).toBe(true);
      expect(
        result.value.zones.every((zone) => zone.configured === false),
      ).toBe(true);
    }
    expect(merchants.get(MERCHANT_A)?.merchantDeliveryEnabled).toBe(true);
    expect(merchants.get(MERCHANT_A)?.pickupEnabled).toBe(true);
  });

  it("creates an active Rawson zone with exact cents and minutes", async () => {
    const { deps, rowsByMerchant } = memoryStore();
    const result = await saveMerchantDeliverySettings(
      MERCHANT_A,
      emptyInput({
        merchantDeliveryEnabled: true,
        zones: [rawsonActive(), blankZone(ZONE_PLAYA)],
      }),
      deps,
    );
    expect(result.ok).toBe(true);
    const row = rowsByMerchant
      .get(MERCHANT_A)
      ?.find((item) => item.zoneId === ZONE_RAWSON);
    expect(row).toMatchObject({
      zoneName: "Rawson",
      active: true,
      deliveryFeeCents: 150000,
      minimumOrderCents: 200000,
      estimatedMinutes: 30,
    });
    expect(rowsByMerchant.get(MERCHANT_A)).toHaveLength(1);
  });

  it("creates an active Playa Unión zone", async () => {
    const { deps, rowsByMerchant } = memoryStore();
    const result = await saveMerchantDeliverySettings(
      MERCHANT_A,
      emptyInput({
        merchantDeliveryEnabled: true,
        zones: [blankZone(ZONE_RAWSON), playaActive()],
      }),
      deps,
    );
    expect(result.ok).toBe(true);
    const row = rowsByMerchant
      .get(MERCHANT_A)
      ?.find((item) => item.zoneId === ZONE_PLAYA);
    expect(row).toMatchObject({
      zoneName: "Playa Unión",
      active: true,
      deliveryFeeCents: 80000,
      minimumOrderCents: 0,
      estimatedMinutes: 45,
    });
  });

  it("deactivates a zone and preserves fee, minimum and ETA", async () => {
    const { deps, rowsByMerchant } = memoryStore();
    await saveMerchantDeliverySettings(
      MERCHANT_A,
      emptyInput({
        merchantDeliveryEnabled: true,
        zones: [rawsonActive(), blankZone(ZONE_PLAYA)],
      }),
      deps,
    );
    const deactivated = await saveMerchantDeliverySettings(
      MERCHANT_A,
      emptyInput({
        merchantDeliveryEnabled: true,
        zones: [{ ...rawsonActive(), active: false }, blankZone(ZONE_PLAYA)],
      }),
      deps,
    );
    expect(deactivated.ok).toBe(true);
    const row = rowsByMerchant
      .get(MERCHANT_A)
      ?.find((item) => item.zoneId === ZONE_RAWSON);
    expect(row).toMatchObject({
      active: false,
      deliveryFeeCents: 150000,
      minimumOrderCents: 200000,
      estimatedMinutes: 30,
    });
    expect(rowsByMerchant.get(MERCHANT_A)).toHaveLength(1);
  });

  it("reactivates a zone with the same stored values", async () => {
    const { deps } = memoryStore();
    await saveMerchantDeliverySettings(
      MERCHANT_A,
      emptyInput({
        merchantDeliveryEnabled: true,
        zones: [{ ...rawsonActive(), active: false }, blankZone(ZONE_PLAYA)],
      }),
      deps,
    );
    const reactivated = await saveMerchantDeliverySettings(
      MERCHANT_A,
      emptyInput({
        merchantDeliveryEnabled: true,
        zones: [rawsonActive(), blankZone(ZONE_PLAYA)],
      }),
      deps,
    );
    expect(reactivated.ok).toBe(true);
    if (reactivated.ok) {
      const rawson = reactivated.value.zones.find(
        (zone) => zone.zoneId === ZONE_RAWSON,
      );
      expect(rawson).toMatchObject({
        configured: true,
        active: true,
        deliveryFeeCents: 150000,
        minimumOrderCents: 200000,
        estimatedMinutes: 30,
      });
    }
  });

  it("keeps zone rows when merchant delivery is disabled", async () => {
    const { deps, rowsByMerchant, merchants } = memoryStore();
    await saveMerchantDeliverySettings(
      MERCHANT_A,
      emptyInput({
        merchantDeliveryEnabled: true,
        zones: [rawsonActive(), blankZone(ZONE_PLAYA)],
      }),
      deps,
    );
    const disabled = await saveMerchantDeliverySettings(
      MERCHANT_A,
      emptyInput({
        merchantDeliveryEnabled: false,
        zones: [rawsonActive(), blankZone(ZONE_PLAYA)],
      }),
      deps,
    );
    expect(disabled.ok).toBe(true);
    expect(merchants.get(MERCHANT_A)?.merchantDeliveryEnabled).toBe(false);
    expect(rowsByMerchant.get(MERCHANT_A)).toHaveLength(1);
    expect(rowsByMerchant.get(MERCHANT_A)?.[0]).toMatchObject({
      zoneId: ZONE_RAWSON,
      deliveryFeeCents: 150000,
      estimatedMinutes: 30,
    });
  });

  it("restores checkout use when merchant delivery is re-enabled", async () => {
    const { deps, merchants, rowsByMerchant } = memoryStore();
    await saveMerchantDeliverySettings(
      MERCHANT_A,
      emptyInput({
        merchantDeliveryEnabled: true,
        zones: [rawsonActive(), blankZone(ZONE_PLAYA)],
      }),
      deps,
    );
    await saveMerchantDeliverySettings(
      MERCHANT_A,
      emptyInput({
        merchantDeliveryEnabled: false,
        zones: [rawsonActive(), blankZone(ZONE_PLAYA)],
      }),
      deps,
    );
    const reenabled = await saveMerchantDeliverySettings(
      MERCHANT_A,
      emptyInput({
        merchantDeliveryEnabled: true,
        zones: [rawsonActive(), blankZone(ZONE_PLAYA)],
      }),
      deps,
    );
    expect(reenabled.ok).toBe(true);
    expect(merchants.get(MERCHANT_A)?.merchantDeliveryEnabled).toBe(true);
    expect(rowsByMerchant.get(MERCHANT_A)?.[0]?.active).toBe(true);

    const listed = await listMerchantDeliverySettings(MERCHANT_A, deps);
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value.merchantDeliveryEnabled).toBe(true);
      expect(
        listed.value.zones.find((zone) => zone.zoneId === ZONE_RAWSON)?.active,
      ).toBe(true);
    }
  });

  it("does not duplicate merchant+zone on repeated save", async () => {
    const { deps, rowsByMerchant } = memoryStore();
    const payload = emptyInput({
      merchantDeliveryEnabled: true,
      zones: [rawsonActive(), blankZone(ZONE_PLAYA)],
    });
    await saveMerchantDeliverySettings(MERCHANT_A, payload, deps);
    await saveMerchantDeliverySettings(MERCHANT_A, payload, deps);
    expect(
      rowsByMerchant
        .get(MERCHANT_A)
        ?.filter((row) => row.zoneId === ZONE_RAWSON),
    ).toHaveLength(1);
    expect(rowsByMerchant.get(MERCHANT_A)).toHaveLength(1);
  });

  it("rejects a zone outside the merchant city", async () => {
    const { deps } = memoryStore();
    const result = await saveMerchantDeliverySettings(
      MERCHANT_A,
      emptyInput({
        merchantDeliveryEnabled: true,
        zones: [
          {
            zoneId: ZONE_FOREIGN,
            active: true,
            feeInput: "100",
            minimumInput: "0",
            estimatedMinutesInput: "20",
          },
        ],
      }),
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ZONE_NOT_ALLOWED");
    }
    expect(deps.saveDeliverySettings).not.toHaveBeenCalled();
  });

  it("does not write merchant B when authorized for A", async () => {
    const { deps, rowsByMerchant } = memoryStore();
    await saveMerchantDeliverySettings(
      MERCHANT_A,
      emptyInput({
        merchantDeliveryEnabled: true,
        zones: [rawsonActive(), blankZone(ZONE_PLAYA)],
      }),
      deps,
    );
    expect(deps.requireDeliveryAccess).toHaveBeenCalledWith(MERCHANT_A);
    expect(deps.saveDeliverySettings).toHaveBeenCalledWith(
      MERCHANT_A,
      expect.any(Object),
    );
    expect(deps.saveDeliverySettings).not.toHaveBeenCalledWith(
      MERCHANT_B,
      expect.anything(),
    );
    expect(rowsByMerchant.get(MERCHANT_B)).toEqual([]);
  });

  it("rejects cross-merchant writes at the access gate", async () => {
    const { deps } = memoryStore();
    deps.requireDeliveryAccess = vi.fn(async (merchantId) => {
      if (merchantId !== MERCHANT_A) {
        throw new AuthzError("NOT_MERCHANT_MEMBER", "no");
      }
    });
    await expect(
      saveMerchantDeliverySettings(MERCHANT_B, emptyInput(), deps),
    ).rejects.toMatchObject({ code: "NOT_MERCHANT_MEMBER" });
    expect(deps.saveDeliverySettings).not.toHaveBeenCalled();
  });

  it("allows OWNER and STAFF through the access gate", async () => {
    const { deps } = memoryStore();
    const result = await saveMerchantDeliverySettings(
      MERCHANT_A,
      emptyInput({ merchantDeliveryEnabled: true }),
      deps,
    );
    expect(result.ok).toBe(true);
    expect(deps.requireDeliveryAccess).toHaveBeenCalledWith(MERCHANT_A);
  });

  it("rejects invalid money and does not write", async () => {
    const { deps } = memoryStore();
    const result = await saveMerchantDeliverySettings(
      MERCHANT_A,
      emptyInput({
        merchantDeliveryEnabled: true,
        zones: [
          {
            zoneId: ZONE_RAWSON,
            active: true,
            feeInput: "abc",
            minimumInput: "0",
            estimatedMinutesInput: "30",
          },
          blankZone(ZONE_PLAYA),
        ],
      }),
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_DELIVERY_FEE");
    }
    expect(deps.saveDeliverySettings).not.toHaveBeenCalled();
  });

  it("rejects non-integer estimated minutes", async () => {
    const { deps } = memoryStore();
    const result = await saveMerchantDeliverySettings(
      MERCHANT_A,
      emptyInput({
        merchantDeliveryEnabled: true,
        zones: [
          {
            zoneId: ZONE_RAWSON,
            active: true,
            feeInput: "0",
            minimumInput: "0",
            estimatedMinutesInput: "30.5",
          },
          blankZone(ZONE_PLAYA),
        ],
      }),
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_ESTIMATED_MINUTES");
    }
    expect(deps.saveDeliverySettings).not.toHaveBeenCalled();
  });
});

describe("checkout configuration after delivery settings", () => {
  it("includes only active zones when merchant delivery is enabled", async () => {
    const { deps, merchants, rowsByMerchant } = memoryStore();
    await saveMerchantDeliverySettings(
      MERCHANT_A,
      emptyInput({
        merchantDeliveryEnabled: true,
        zones: [rawsonActive(), { ...playaActive(), active: false }],
      }),
      deps,
    );

    const context = merchants.get(MERCHANT_A)!;
    const config = await getCheckoutConfiguration(MERCHANT_A, {
      now: () => new Date("2026-08-14T12:00:00.000Z"),
      findMerchantById: async () => checkoutMerchant(context),
      listPaymentMethodsForMerchant: async () => [
        { code: "CASH", label: "Efectivo", instructions: "", active: true },
      ],
      listDeliveryZonesForMerchant: async () =>
        toCheckoutZones(MERCHANT_A, rowsByMerchant.get(MERCHANT_A) ?? []),
    });

    expect(config?.merchant.merchantDeliveryEnabled).toBe(true);
    expect(config?.merchant.pickupEnabled).toBe(true);
    expect(config?.deliveryZones).toEqual([
      {
        zoneId: ZONE_RAWSON,
        zoneName: "Rawson",
        cityName: "Rawson",
        feeCents: 150000,
        minimumOrderCents: 200000,
        estimatedMinutes: 30,
      },
    ]);
    expect(JSON.stringify(config)).not.toContain("PLATFORM");
    expect(JSON.stringify(config)).not.toContain("platformDelivery");
  });

  it("hides delivery zones while pickup stays available when delivery is disabled", async () => {
    const { deps, merchants, rowsByMerchant } = memoryStore();
    await saveMerchantDeliverySettings(
      MERCHANT_A,
      emptyInput({
        merchantDeliveryEnabled: true,
        zones: [rawsonActive(), blankZone(ZONE_PLAYA)],
      }),
      deps,
    );
    await saveMerchantDeliverySettings(
      MERCHANT_A,
      emptyInput({
        merchantDeliveryEnabled: false,
        zones: [rawsonActive(), blankZone(ZONE_PLAYA)],
      }),
      deps,
    );

    const context = merchants.get(MERCHANT_A)!;
    const config = await getCheckoutConfiguration(MERCHANT_A, {
      now: () => new Date("2026-08-14T12:00:00.000Z"),
      findMerchantById: async () => checkoutMerchant(context),
      listPaymentMethodsForMerchant: async () => [
        { code: "CASH", label: "Efectivo", instructions: "", active: true },
      ],
      listDeliveryZonesForMerchant: async () =>
        toCheckoutZones(MERCHANT_A, rowsByMerchant.get(MERCHANT_A) ?? []),
    });

    expect(config?.merchant.pickupEnabled).toBe(true);
    expect(config?.merchant.merchantDeliveryEnabled).toBe(false);
    expect(config?.deliveryZones).toEqual([]);
    expect(rowsByMerchant.get(MERCHANT_A)).toHaveLength(1);
  });
});
