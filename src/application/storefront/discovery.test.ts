import { describe, expect, it, vi } from "vitest";
import {
  getPublicDiscovery,
  type DiscoveryMerchantRecord,
  type GetPublicDiscoveryDeps,
} from "./discovery";

const ZONE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ZONE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MERCHANT = "11111111-1111-4111-8111-111111111111";

function baseDeps(): GetPublicDiscoveryDeps {
  return {
    listZones: vi.fn(async () => [
      {
        id: ZONE_A,
        name: "Rawson",
        cityName: "Rawson",
        cityTimezone: "America/Argentina/Catamarca",
      },
      {
        id: ZONE_B,
        name: "Playa Unión",
        cityName: "Rawson",
        cityTimezone: "America/Argentina/Catamarca",
      },
    ]),
    findZoneById: vi.fn(async (id: string) =>
      id === ZONE_A
        ? {
            id: ZONE_A,
            name: "Rawson",
            cityName: "Rawson",
            cityTimezone: "America/Argentina/Catamarca",
          }
        : null,
    ),
    listMerchantsServingZone: vi.fn(async () => [
      {
        id: MERCHANT,
        name: "Comercio Prueba",
        description: "Demo",
        status: "ACTIVE",
        zoneId: ZONE_A,
        zoneName: "Rawson",
        cityTimezone: "America/Argentina/Catamarca",
        pickupEnabled: true,
        merchantDeliveryEnabled: true,
        preparationMinutes: 25,
        acceptingOrders: true,
        pausedUntil: null,
        coverImagePath: null,
      },
    ]),
    listDeliveryZonesForMerchants: vi.fn(async () => [
      {
        merchantId: MERCHANT,
        zoneId: ZONE_A,
        deliveryFeeCents: 250000,
        minimumOrderCents: 1000000,
        estimatedMinutes: 35,
        active: true,
      },
    ]),
    listOpeningIntervalsForMerchants: vi.fn(async () => []),
    createCoverSignedUrls: vi.fn(async () => new Map()),
    now: () => new Date("2026-08-12T15:00:00.000Z"),
  };
}

describe("getPublicDiscovery", () => {
  it("returns zones without merchants when no zone selected", async () => {
    const deps = baseDeps();
    const result = await getPublicDiscovery(null, deps);
    expect(result.zones).toHaveLength(2);
    expect(result.selectedZone).toBeNull();
    expect(result.merchants).toHaveLength(0);
    expect(deps.listMerchantsServingZone).not.toHaveBeenCalled();
  });

  it("builds merchant cards with logistics and no private fields", async () => {
    const deps = baseDeps();
    const result = await getPublicDiscovery(ZONE_A, deps);
    expect(result.selectedZone?.name).toBe("Rawson");
    expect(result.merchants).toHaveLength(1);
    const card = result.merchants[0]!;
    expect(card.availabilityLabel).toBe("Disponible");
    expect(card.logistics.deliveryFeeLabel).toContain("$");
    expect(card.href).toBe(`/comercios/${MERCHANT}`);
    expect(card.coverUrl).toBeNull();

    const serialized = JSON.stringify(card);
    expect(serialized).not.toMatch(/email/i);
    expect(serialized).not.toMatch(/userId/i);
    expect(serialized).not.toMatch(/membership/i);
    expect(serialized).not.toMatch(/SECRET/i);
    expect(serialized).not.toMatch(/acceptingOrders/);
    expect(serialized).not.toMatch(/pausedUntil/);
    expect(serialized).not.toMatch(/coverImagePath/);
    expect(serialized).not.toMatch(/cover_image_path/);
  });

  it("marks future pause as Pausado temporalmente", async () => {
    const deps = baseDeps();
    const paused: DiscoveryMerchantRecord = {
      id: MERCHANT,
      name: "Comercio Prueba",
      description: "",
      status: "ACTIVE",
      zoneId: ZONE_A,
      zoneName: "Rawson",
      cityTimezone: "America/Argentina/Catamarca",
      pickupEnabled: true,
      merchantDeliveryEnabled: false,
      preparationMinutes: 20,
      acceptingOrders: true,
      pausedUntil: new Date("2026-08-12T16:00:00.000Z"),
      coverImagePath: null,
    };
    deps.listMerchantsServingZone = vi.fn(async () => [paused]);
    const result = await getPublicDiscovery(ZONE_A, deps);
    expect(result.merchants[0]?.availabilityLabel).toBe(
      "Pausado temporalmente",
    );
  });

  it("exposes a signed coverUrl without the storage path", async () => {
    const coverPath = `${MERCHANT}/cover/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp`;
    const deps = baseDeps();
    deps.listMerchantsServingZone = vi.fn(async () => [
      {
        id: MERCHANT,
        name: "Comercio Prueba",
        description: "Demo",
        status: "ACTIVE",
        zoneId: ZONE_A,
        zoneName: "Rawson",
        cityTimezone: "America/Argentina/Catamarca",
        pickupEnabled: true,
        merchantDeliveryEnabled: true,
        preparationMinutes: 25,
        acceptingOrders: true,
        pausedUntil: null,
        coverImagePath: coverPath,
      },
    ]);
    deps.createCoverSignedUrls = vi.fn(async () => {
      const map = new Map<string, string>();
      map.set(coverPath, "https://signed.example/cover.webp");
      return map;
    });

    const result = await getPublicDiscovery(ZONE_A, deps);
    expect(result.merchants[0]?.coverUrl).toBe(
      "https://signed.example/cover.webp",
    );
    expect(deps.createCoverSignedUrls).toHaveBeenCalledWith([coverPath]);
    const serialized = JSON.stringify(result.merchants[0]);
    expect(serialized).not.toMatch(/coverImagePath/);
    expect(serialized).not.toMatch(/cover_image_path/);
  });
});
