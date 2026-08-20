import { describe, expect, it, vi } from "vitest";
import {
  assemblePublicMarketplaceCategories,
  getPublicDiscovery,
  type DiscoveryMerchantRecord,
  type GetPublicDiscoveryDeps,
} from "./discovery";

const ZONE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ZONE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MERCHANT = "11111111-1111-4111-8111-111111111111";
const MERCHANT_B = "22222222-2222-4222-8222-222222222222";
const CAT_PIZZA = "33333333-3333-4333-8333-333333333333";
const CAT_ALMACEN = "44444444-4444-4444-8444-444444444444";
const CAT_INACTIVE = "55555555-5555-4555-8555-555555555555";

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
    listMarketplaceCategoryLinksForMerchants: vi.fn(async () => []),
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
    expect(result.categories).toHaveLength(0);
    expect(deps.listMerchantsServingZone).not.toHaveBeenCalled();
    expect(
      deps.listMarketplaceCategoryLinksForMerchants,
    ).not.toHaveBeenCalled();
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
    expect(card.categoryIds).toEqual([]);
    expect(result.categories).toEqual([]);

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

describe("assemblePublicMarketplaceCategories", () => {
  it("keeps only active categories and a stable sort_order", () => {
    const { categories, categoryIdsByMerchantId } =
      assemblePublicMarketplaceCategories([
        {
          merchantId: MERCHANT,
          categoryId: CAT_ALMACEN,
          name: "Almacén",
          slug: "almacen",
          sortOrder: 2,
          active: true,
        },
        {
          merchantId: MERCHANT,
          categoryId: CAT_PIZZA,
          name: "Pizza",
          slug: "pizza",
          sortOrder: 1,
          active: true,
        },
        {
          merchantId: MERCHANT,
          categoryId: CAT_INACTIVE,
          name: "Oculta",
          slug: "oculta",
          sortOrder: 0,
          active: false,
        },
      ]);

    expect(categories.map((category) => category.slug)).toEqual([
      "pizza",
      "almacen",
    ]);
    expect(categories[0]).toEqual({
      id: CAT_PIZZA,
      name: "Pizza",
      slug: "pizza",
    });
    expect(categoryIdsByMerchantId.get(MERCHANT)).toEqual([
      CAT_PIZZA,
      CAT_ALMACEN,
    ]);
  });
});

describe("getPublicDiscovery marketplace categories", () => {
  it("attaches real categoryIds and omits empty or inactive taxonomy", async () => {
    const deps = baseDeps();
    deps.listMarketplaceCategoryLinksForMerchants = vi.fn(async () => [
      {
        merchantId: MERCHANT,
        categoryId: CAT_PIZZA,
        name: "Pizza",
        slug: "pizza",
        sortOrder: 1,
        active: true,
      },
      {
        merchantId: MERCHANT,
        categoryId: CAT_INACTIVE,
        name: "Inactiva",
        slug: "inactiva",
        sortOrder: 0,
        active: false,
      },
    ]);

    const result = await getPublicDiscovery(ZONE_A, deps);
    expect(result.categories).toEqual([
      { id: CAT_PIZZA, name: "Pizza", slug: "pizza" },
    ]);
    expect(result.merchants[0]?.categoryIds).toEqual([CAT_PIZZA]);
    expect(Object.keys(result.categories[0]!)).toEqual(["id", "name", "slug"]);
    expect(deps.listMarketplaceCategoryLinksForMerchants).toHaveBeenCalledWith([
      MERCHANT,
    ]);
  });

  it("only includes categories linked to merchants of the selected zone", async () => {
    const deps = baseDeps();
    deps.listMerchantsServingZone = vi.fn(async (zoneId: string) =>
      zoneId === ZONE_A
        ? [
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
          ]
        : [
            {
              id: MERCHANT_B,
              name: "Comercio Playa",
              description: "Demo playa",
              status: "ACTIVE",
              zoneId: ZONE_B,
              zoneName: "Playa Unión",
              cityTimezone: "America/Argentina/Catamarca",
              pickupEnabled: true,
              merchantDeliveryEnabled: false,
              preparationMinutes: 20,
              acceptingOrders: true,
              pausedUntil: null,
              coverImagePath: null,
            },
          ],
    );
    deps.findZoneById = vi.fn(async (id: string) =>
      id === ZONE_A
        ? {
            id: ZONE_A,
            name: "Rawson",
            cityName: "Rawson",
            cityTimezone: "America/Argentina/Catamarca",
          }
        : {
            id: ZONE_B,
            name: "Playa Unión",
            cityName: "Rawson",
            cityTimezone: "America/Argentina/Catamarca",
          },
    );
    deps.listMarketplaceCategoryLinksForMerchants = vi.fn(
      async (merchantIds: string[]) => {
        if (merchantIds.includes(MERCHANT)) {
          return [
            {
              merchantId: MERCHANT,
              categoryId: CAT_PIZZA,
              name: "Pizza",
              slug: "pizza",
              sortOrder: 1,
              active: true,
            },
          ];
        }
        return [
          {
            merchantId: MERCHANT_B,
            categoryId: CAT_ALMACEN,
            name: "Almacén",
            slug: "almacen",
            sortOrder: 2,
            active: true,
          },
        ];
      },
    );

    const rawson = await getPublicDiscovery(ZONE_A, deps);
    const playa = await getPublicDiscovery(ZONE_B, deps);

    expect(rawson.categories.map((category) => category.slug)).toEqual([
      "pizza",
    ]);
    expect(playa.categories.map((category) => category.slug)).toEqual([
      "almacen",
    ]);
    expect(rawson.merchants[0]?.categoryIds).toEqual([CAT_PIZZA]);
    expect(playa.merchants[0]?.categoryIds).toEqual([CAT_ALMACEN]);
  });

  it("keeps paused public merchants and their category associations", async () => {
    const deps = baseDeps();
    deps.listMerchantsServingZone = vi.fn(async () => [
      {
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
        acceptingOrders: false,
        pausedUntil: null,
        coverImagePath: null,
      },
    ]);
    deps.listMarketplaceCategoryLinksForMerchants = vi.fn(async () => [
      {
        merchantId: MERCHANT,
        categoryId: CAT_ALMACEN,
        name: "Almacén",
        slug: "almacen",
        sortOrder: 2,
        active: true,
      },
    ]);

    const result = await getPublicDiscovery(ZONE_A, deps);
    expect(result.merchants[0]?.availabilityTone).not.toBe("available");
    expect(result.categories).toHaveLength(1);
    expect(result.merchants[0]?.categoryIds).toEqual([CAT_ALMACEN]);
  });
});
