import { describe, expect, it, vi } from "vitest";
import {
  getPublicMerchantCatalog,
  type GetPublicMerchantCatalogDeps,
} from "./merchant-catalog";

const MERCHANT = "11111111-1111-4111-8111-111111111111";
const ZONE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CAT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PROD = "33333333-3333-4333-8333-333333333333";
const GROUP = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function baseDeps(): GetPublicMerchantCatalogDeps {
  return {
    findActiveMerchantById: vi.fn(async () => ({
      id: MERCHANT,
      name: "Comercio Prueba",
      description: "Buenas empanadas",
      status: "ACTIVE",
      zoneId: ZONE,
      zoneName: "Rawson",
      cityName: "Rawson",
      cityTimezone: "America/Argentina/Catamarca",
      pickupEnabled: true,
      merchantDeliveryEnabled: false,
      preparationMinutes: 20,
      acceptingOrders: true,
      pausedUntil: null,
    })),
    listActiveCategories: vi.fn(async () => [
      { id: CAT, name: "Bebidas", sortOrder: 0 },
    ]),
    listActiveProducts: vi.fn(async () => [
      {
        id: PROD,
        merchantCategoryId: CAT,
        categoryName: "Bebidas",
        name: "Coca Cola",
        description: "1.5 L",
        priceCents: 250000,
        active: true,
        available: true,
        stockMode: "TRACKED",
        stockQuantity: 4,
        sortOrder: 0,
        imagePath: `${MERCHANT}/products/${PROD}/img.jpg`,
        optionGroupCount: 1,
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        merchantCategoryId: CAT,
        categoryName: "Bebidas",
        name: "Oculto",
        description: "",
        priceCents: 100,
        active: false,
        available: true,
        stockMode: "NOT_TRACKED",
        stockQuantity: null,
        sortOrder: 1,
        imagePath: null,
        optionGroupCount: 0,
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        merchantCategoryId: CAT,
        categoryName: "Bebidas",
        name: "Sin stock",
        description: "",
        priceCents: 1000,
        active: true,
        available: true,
        stockMode: "TRACKED",
        stockQuantity: 0,
        sortOrder: 2,
        imagePath: null,
        optionGroupCount: 0,
      },
    ]),
    listActiveOptionGroups: vi.fn(async () => [
      {
        id: GROUP,
        productId: PROD,
        name: "Docena",
        selectionMode: "QUANTITY",
        minSelections: 12,
        maxSelections: 12,
        sortOrder: 0,
      },
    ]),
    listActiveOptionChoices: vi.fn(async () => [
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        groupId: GROUP,
        name: "Carne",
        priceDeltaCents: 0,
        sortOrder: 0,
      },
    ]),
    listDeliveryZones: vi.fn(async () => []),
    listPaymentMethods: vi.fn(async () => [
      { label: "Efectivo", instructions: "" },
    ]),
    listOpeningIntervals: vi.fn(async () => []),
    createSignedUrls: vi.fn(async (paths: readonly string[]) => {
      const map = new Map<string, string>();
      for (const path of paths) {
        map.set(path, `https://signed.example/${path}?token=temp`);
      }
      return map;
    }),
    now: () => new Date("2026-08-12T15:00:00.000Z"),
  };
}

describe("getPublicMerchantCatalog", () => {
  it("returns null for DRAFT/missing merchants", async () => {
    const deps = baseDeps();
    deps.findActiveMerchantById = vi.fn(async () => null);
    await expect(
      getPublicMerchantCatalog(MERCHANT, ZONE, deps),
    ).resolves.toBeNull();
  });

  it("hides inactive products and marks stock 0 as Sin stock", async () => {
    const deps = baseDeps();
    const page = await getPublicMerchantCatalog(MERCHANT, ZONE, deps);
    expect(page).not.toBeNull();
    expect(page!.products.map((p) => p.name)).toEqual([
      "Coca Cola",
      "Sin stock",
    ]);
    const out = page!.products.find((p) => p.name === "Sin stock");
    expect(out?.sellable).toBe(false);
    expect(out?.statusLabel).toBe("Sin stock");
  });

  it("formats MoneyCents prices and QUANTITY dozen copy", async () => {
    const deps = baseDeps();
    const page = await getPublicMerchantCatalog(MERCHANT, ZONE, deps);
    const coke = page!.products.find((p) => p.name === "Coca Cola")!;
    expect(coke.priceLabel).toBe("$2.500,00");
    expect(coke.optionGroups[0]?.hint).toBe(
      "Elegí 12 unidades entre estas variedades.",
    );
    expect(coke.optionGroups[0]?.modeLabel).toBe("Variedades");
    expect(coke.priceCents).toBe(250000);
    expect(coke.canAddToCart).toBe(true);
    expect(coke.optionGroups[0]?.selectionMode).toBe("QUANTITY");
    expect(coke.optionGroups[0]?.minSelections).toBe(12);
    expect(coke.optionGroups[0]?.maxSelections).toBe(12);
  });

  it("uses signed URLs without persisting them on the product path", async () => {
    const deps = baseDeps();
    const page = await getPublicMerchantCatalog(MERCHANT, ZONE, deps);
    const coke = page!.products.find((p) => p.name === "Coca Cola")!;
    expect(coke.imageUrl).toContain("https://signed.example/");
    expect(deps.createSignedUrls).toHaveBeenCalled();
    const serialized = JSON.stringify(page);
    expect(serialized).not.toMatch(/imagePath/);
    expect(serialized).not.toMatch(/email/i);
    expect(serialized).not.toMatch(/userId/i);
    expect(serialized).not.toMatch(/SUPABASE/);
    expect(serialized).not.toMatch(/membership/i);
  });

  it("shows placeholder path as null imageUrl when no image", async () => {
    const deps = baseDeps();
    const page = await getPublicMerchantCatalog(MERCHANT, ZONE, deps);
    const noImage = page!.products.find((p) => p.name === "Sin stock")!;
    expect(noImage.imageUrl).toBeNull();
  });
});
