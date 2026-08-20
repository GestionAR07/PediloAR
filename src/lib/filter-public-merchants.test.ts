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
});

describe("merchantCardHref", () => {
  it("keeps the real merchant path and appends the current zone", () => {
    expect(merchantCardHref("/comercios/abc", null)).toBe("/comercios/abc");
    expect(merchantCardHref("/comercios/abc", "zone-1")).toBe(
      "/comercios/abc?zone=zone-1",
    );
  });
});
