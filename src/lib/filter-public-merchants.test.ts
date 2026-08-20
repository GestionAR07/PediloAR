import { describe, expect, it } from "vitest";
import type { PublicMerchantCard } from "@/application/storefront/types";
import {
  filterPublicMerchants,
  merchantCardHref,
} from "./filter-public-merchants";

function card(
  overrides: Partial<PublicMerchantCard> & Pick<PublicMerchantCard, "id">,
): PublicMerchantCard {
  return {
    name: "Almacén Centro",
    zoneName: "Rawson",
    description: "Fiambres y almacén de barrio",
    availabilityLabel: "Disponible",
    availabilityTone: "available",
    hoursLabel: null,
    hoursDetail: null,
    logistics: {
      pickupAvailable: true,
      deliveryAvailable: true,
      deliveryFeeLabel: "Envío $2.500",
      minimumOrderLabel: "Compra mínima $10.000",
      estimatedMinutesLabel: "35 min",
      preparationMinutesLabel: "Prep. ~25 min",
    },
    href: `/comercios/${overrides.id}`,
    categoryIds: [],
    coverUrl: null,
    ...overrides,
  };
}

describe("filterPublicMerchants", () => {
  const merchants = [
    card({ id: "a", name: "Almacén Centro", description: "Fiambres" }),
    card({
      id: "b",
      name: "Pizzería Sur",
      description: "Pizzas a la piedra",
    }),
  ];

  it("returns all merchants when the query is blank or whitespace", () => {
    expect(filterPublicMerchants(merchants, "")).toEqual(merchants);
    expect(filterPublicMerchants(merchants, "   ")).toEqual(merchants);
  });

  it("matches name and description case-insensitively after trim", () => {
    expect(
      filterPublicMerchants(merchants, "  PIZZA  ").map((m) => m.id),
    ).toEqual(["b"]);
    expect(
      filterPublicMerchants(merchants, "fiambres").map((m) => m.id),
    ).toEqual(["a"]);
  });

  it("does not look at product fields that are not on the card", () => {
    const serialized = JSON.stringify(merchants);
    expect(serialized).not.toMatch(/priceCents/);
    expect(serialized).not.toMatch(/product/i);
    expect(filterPublicMerchants(merchants, "empanadas")).toEqual([]);
  });

  it("returns all merchants when no category is selected", () => {
    const withCategories = [
      card({ id: "a", categoryIds: ["cat-almacen"] }),
      card({ id: "b", categoryIds: ["cat-pizza"] }),
    ];
    expect(filterPublicMerchants(withCategories, "", null)).toEqual(
      withCategories,
    );
    expect(filterPublicMerchants(withCategories, "  ", "")).toEqual(
      withCategories,
    );
  });

  it("filters by real categoryIds before applying search", () => {
    const withCategories = [
      card({
        id: "a",
        name: "Almacén Centro",
        description: "Fiambres",
        categoryIds: ["cat-almacen"],
      }),
      card({
        id: "b",
        name: "Pizzería Sur",
        description: "Pizzas a la piedra",
        categoryIds: ["cat-pizza"],
      }),
      card({
        id: "c",
        name: "Pizza del Almacén",
        description: "Lista",
        categoryIds: ["cat-almacen", "cat-pizza"],
      }),
    ];

    expect(
      filterPublicMerchants(withCategories, "", "cat-pizza").map((m) => m.id),
    ).toEqual(["b", "c"]);
    expect(
      filterPublicMerchants(withCategories, "almacén", "cat-pizza").map(
        (m) => m.id,
      ),
    ).toEqual(["c"]);
    expect(
      filterPublicMerchants(withCategories, "fiambres", "cat-pizza"),
    ).toEqual([]);
  });

  it("treats an unknown category as empty rather than inventing matches", () => {
    const withCategories = [card({ id: "a", categoryIds: ["cat-almacen"] })];
    expect(filterPublicMerchants(withCategories, "", "missing")).toEqual([]);
  });
});

describe("merchantCardHref", () => {
  it("keeps the real merchant path and appends the current zone", () => {
    expect(merchantCardHref("/comercios/abc", null)).toBe("/comercios/abc");
    expect(merchantCardHref("/comercios/abc", "zone-1")).toBe(
      "/comercios/abc?zone=zone-1",
    );
  });
});
