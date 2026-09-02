import { describe, expect, it, vi } from "vitest";
import {
  getPublicMerchantCatalog,
  type GetPublicMerchantCatalogDeps,
} from "./merchant-catalog";

const MERCHANT = "11111111-1111-4111-8111-111111111111";
const ZONE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CATEGORY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PRODUCT = "33333333-3333-4333-8333-333333333333";
const WEDNESDAY = 3;

function depsWithOpenings(
  openings: Awaited<
    ReturnType<GetPublicMerchantCatalogDeps["listOpeningIntervals"]>
  >,
): GetPublicMerchantCatalogDeps {
  return {
    findActiveMerchantById: vi.fn(async () => ({
      id: MERCHANT,
      name: "Comercio Prueba",
      description: "",
      status: "ACTIVE",
      zoneId: ZONE,
      zoneName: "Rawson",
      cityName: "Rawson",
      cityTimezone: "UTC",
      pickupEnabled: true,
      merchantDeliveryEnabled: false,
      preparationMinutes: 20,
      acceptingOrders: true,
      pausedUntil: null,
      coverImagePath: null,
    })),
    listActiveCategories: vi.fn(async () => [
      { id: CATEGORY, name: "Bebidas", sortOrder: 0 },
    ]),
    listActiveProducts: vi.fn(async () => [
      {
        id: PRODUCT,
        merchantCategoryId: CATEGORY,
        categoryName: "Bebidas",
        name: "Coca Cola",
        description: "",
        priceCents: 250000,
        active: true,
        available: true,
        stockMode: "TRACKED",
        stockQuantity: 4,
        sortOrder: 0,
        imagePath: null,
        optionGroupCount: 0,
      },
    ]),
    listActiveOptionGroups: vi.fn(async () => []),
    listActiveOptionChoices: vi.fn(async () => []),
    listDeliveryZones: vi.fn(async () => []),
    listPaymentMethods: vi.fn(async () => [
      { code: "CASH", label: "Efectivo", instructions: "" },
    ]),
    listOpeningIntervals: vi.fn(async () => openings),
    createSignedUrls: vi.fn(async () => new Map()),
    createCoverSignedUrls: vi.fn(async () => new Map()),
    // Wednesday 2026-08-12 15:00 UTC.
    now: () => new Date("2026-08-12T15:00:00.000Z"),
  };
}

describe("public storefront merchant opening hours", () => {
  it("blocks cart additions when configured hours are closed", async () => {
    const deps = depsWithOpenings([
      { weekday: WEDNESDAY, openMinute: 16 * 60, closeMinute: 17 * 60 },
    ]);

    const page = await getPublicMerchantCatalog(MERCHANT, ZONE, deps);
    const product = page!.products[0]!;

    expect(page!.hoursLabel).toBe("Cerrado");
    expect(page!.hoursDetail).toBe("Abre a las 16:00");
    expect(product.sellable).toBe(true);
    expect(product.canAddToCart).toBe(false);
    expect(product.statusLabel).toBe("Cerrado");
  });

  it("allows cart additions when configured hours are open", async () => {
    const deps = depsWithOpenings([
      { weekday: WEDNESDAY, openMinute: 14 * 60, closeMinute: 16 * 60 },
    ]);

    const page = await getPublicMerchantCatalog(MERCHANT, ZONE, deps);
    const product = page!.products[0]!;

    expect(page!.hoursLabel).toBe("Abierto");
    expect(product.canAddToCart).toBe(true);
    expect(product.statusLabel).toBeNull();
  });

  it("keeps the existing fail-neutral behavior when hours are unknown", async () => {
    const deps = depsWithOpenings([]);

    const page = await getPublicMerchantCatalog(MERCHANT, ZONE, deps);
    const product = page!.products[0]!;

    expect(page!.hoursLabel).toBeNull();
    expect(product.canAddToCart).toBe(true);
    expect(product.statusLabel).toBeNull();
  });
});
