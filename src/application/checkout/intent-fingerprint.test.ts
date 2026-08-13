import { describe, expect, it } from "vitest";
import {
  buildOrderIntentFingerprint,
  canonicalIntentFromRequest,
} from "./intent-fingerprint";
import type { PrepareOrderInput } from "./types";

const pickupBase = {
  merchantId: "m1",
  customerNameSnapshot: "Ana López",
  customerPhoneSnapshot: "2804123456",
  fulfillmentMethod: "PICKUP",
  paymentMethodCode: "CASH",
  delivery: null,
  lines: [
    {
      productId: "p1",
      quantity: 1,
      options: [
        { optionGroupId: "g1", optionChoiceId: "c2", quantity: 3 },
        { optionGroupId: "g1", optionChoiceId: "c1", quantity: 6 },
      ],
    },
  ],
};

describe("buildOrderIntentFingerprint", () => {
  it("is stable for equivalent option order", () => {
    const a = buildOrderIntentFingerprint(pickupBase);
    const b = buildOrderIntentFingerprint({
      ...pickupBase,
      lines: [
        {
          productId: "p1",
          quantity: 1,
          options: [
            { optionGroupId: "g1", optionChoiceId: "c1", quantity: 6 },
            { optionGroupId: "g1", optionChoiceId: "c2", quantity: 3 },
          ],
        },
      ],
    });
    expect(a).toBe(b);
  });

  it("is stable for equivalent line order", () => {
    const a = buildOrderIntentFingerprint({
      ...pickupBase,
      lines: [
        { productId: "p2", quantity: 1, options: [] },
        { productId: "p1", quantity: 2, options: [] },
      ],
    });
    const b = buildOrderIntentFingerprint({
      ...pickupBase,
      lines: [
        { productId: "p1", quantity: 2, options: [] },
        { productId: "p2", quantity: 1, options: [] },
      ],
    });
    expect(a).toBe(b);
  });

  it("does not include pickup customerZoneId", () => {
    const fingerprint = buildOrderIntentFingerprint(pickupBase);
    expect(fingerprint).not.toContain("customerZoneId");
    expect(JSON.parse(fingerprint).delivery).toBeNull();
  });

  it("includes merchant delivery address material", () => {
    const fingerprint = buildOrderIntentFingerprint({
      ...pickupBase,
      fulfillmentMethod: "MERCHANT_DELIVERY",
      delivery: {
        zoneId: "zone-1",
        street: "San Martín",
        number: "123",
        floorApartment: "2A",
        reference: "Timbre",
      },
    });
    const parsed = JSON.parse(fingerprint);
    expect(parsed.delivery).toEqual({
      zoneId: "zone-1",
      street: "San Martín",
      number: "123",
      floorApartment: "2A",
      reference: "Timbre",
    });
  });

  it("treats missing optional delivery fields as empty strings", () => {
    const a = buildOrderIntentFingerprint({
      ...pickupBase,
      fulfillmentMethod: "MERCHANT_DELIVERY",
      delivery: {
        zoneId: "z",
        street: "Sarmiento",
        number: "10",
        floorApartment: "",
        reference: "",
      },
    });
    const b = buildOrderIntentFingerprint({
      ...pickupBase,
      fulfillmentMethod: "MERCHANT_DELIVERY",
      delivery: {
        zoneId: "z",
        street: "Sarmiento",
        number: "10",
        floorApartment: "  ",
        reference: "  ",
      },
    });
    expect(a).toBe(b);
  });

  it("changes when the payload intent changes", () => {
    expect(buildOrderIntentFingerprint(pickupBase)).not.toBe(
      buildOrderIntentFingerprint({
        ...pickupBase,
        paymentMethodCode: "TRANSFER",
      }),
    );
  });
});

describe("canonicalIntentFromRequest", () => {
  const request = (
    overrides: Partial<PrepareOrderInput> = {},
  ): PrepareOrderInput => ({
    merchantId: "11111111-1111-4111-8111-111111111111",
    customerZoneId: "44444444-4444-4444-8444-444444444444",
    customer: { name: "  Ana López  ", phone: "2804123456" },
    fulfillmentMethod: "PICKUP",
    paymentMethodCode: "CASH",
    idempotencyKey: "checkout-retry-key-01",
    lines: [{ productId: "77777777-7777-4777-8777-777777777777", quantity: 1 }],
    ...overrides,
  });

  it("ignores pickup customerZoneId when comparing requests", () => {
    const a = canonicalIntentFromRequest(
      request({ customerZoneId: "44444444-4444-4444-8444-444444444444" }),
    );
    const b = canonicalIntentFromRequest(
      request({ customerZoneId: "55555555-5555-4555-8555-555555555555" }),
    );
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.value).toBe(b.value);
      expect(a.value).not.toContain("44444444-4444-4444-8444-444444444444");
      expect(a.value).not.toContain("55555555-5555-4555-8555-555555555555");
    }
  });

  it("ignores a leftover delivery object on pickup", () => {
    const a = canonicalIntentFromRequest(request());
    const b = canonicalIntentFromRequest(
      request({
        delivery: {
          zoneId: "zone",
          street: "Falsa",
          number: "1",
        },
      }),
    );
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.value).toBe(b.value);
    }
  });
});
