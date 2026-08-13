import { describe, expect, it, vi } from "vitest";
import {
  buildQuoteFingerprint,
  canonicalQuotePayload,
  toCheckoutReview,
} from "./checkout-review";
import { prepareOrder } from "./prepare-order";
import { reviewCheckout } from "./review-checkout";
import type {
  CheckoutDeliveryZoneRecord,
  CheckoutMerchantRecord,
  CheckoutOptionChoiceRecord,
  CheckoutOptionGroupRecord,
  CheckoutPaymentMethodRecord,
  CheckoutProductRecord,
  PreparedOrder,
  PrepareOrderDeps,
  PrepareOrderInput,
} from "./types";
import { moneyCents } from "@/domain/money/money-cents";

const NOW = new Date("2026-08-13T12:00:00.000Z");
const MERCHANT_ID = "11111111-1111-4111-8111-111111111111";
const ZONE_HOME_ID = "44444444-4444-4444-8444-444444444444";
const ZONE_DELIVERY_ID = "55555555-5555-4555-8555-555555555555";
const PROD_SIMPLE_ID = "77777777-7777-4777-8777-777777777777";
const PROD_EMPANADAS_ID = "88888888-8888-4888-8888-888888888888";
const GROUP_SABORES_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CHOICE_CARNE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CHOICE_JYQ_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const CHOICE_VERDURA_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function merchant(): CheckoutMerchantRecord {
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
    platformDeliveryEnabled: false,
    acceptingOrders: true,
    pausedUntil: null,
  };
}

function simpleProduct(
  overrides: Partial<CheckoutProductRecord> = {},
): CheckoutProductRecord {
  return {
    id: PROD_SIMPLE_ID,
    merchantId: MERCHANT_ID,
    name: "Coca 2L",
    priceCents: 100000,
    active: true,
    available: true,
    stockMode: "NOT_TRACKED",
    stockQuantity: null,
    sortOrder: 0,
    ...overrides,
  };
}

function empanadasProduct(): CheckoutProductRecord {
  return {
    id: PROD_EMPANADAS_ID,
    merchantId: MERCHANT_ID,
    name: "Empanadas docena",
    priceCents: 250000,
    active: true,
    available: true,
    stockMode: "NOT_TRACKED",
    stockQuantity: null,
    sortOrder: 1,
  };
}

const saboresGroup: CheckoutOptionGroupRecord = {
  id: GROUP_SABORES_ID,
  productId: PROD_EMPANADAS_ID,
  name: "Sabores",
  selectionMode: "QUANTITY",
  minSelections: 12,
  maxSelections: 12,
  sortOrder: 0,
  active: true,
};

const saboresChoices: CheckoutOptionChoiceRecord[] = [
  {
    id: CHOICE_CARNE_ID,
    groupId: GROUP_SABORES_ID,
    name: "Carne",
    priceDeltaCents: 0,
    sortOrder: 0,
    active: true,
  },
  {
    id: CHOICE_JYQ_ID,
    groupId: GROUP_SABORES_ID,
    name: "Jamón y queso",
    priceDeltaCents: 10000,
    sortOrder: 1,
    active: true,
  },
  {
    id: CHOICE_VERDURA_ID,
    groupId: GROUP_SABORES_ID,
    name: "Verdura",
    priceDeltaCents: 5000,
    sortOrder: 2,
    active: true,
  },
];

function cashPayment(
  overrides: Partial<CheckoutPaymentMethodRecord> = {},
): CheckoutPaymentMethodRecord {
  return {
    code: "CASH",
    label: "Efectivo",
    instructions: "Pagar al recibir",
    active: true,
    ...overrides,
  };
}

function deliveryZone(
  overrides: Partial<CheckoutDeliveryZoneRecord> = {},
): CheckoutDeliveryZoneRecord {
  return {
    merchantId: MERCHANT_ID,
    zoneId: ZONE_DELIVERY_ID,
    zoneName: "Barrio Norte",
    cityId: "33333333-3333-4333-8333-333333333333",
    cityName: "Rawson",
    deliveryFeeCents: 15000,
    minimumOrderCents: 100000,
    estimatedMinutes: 40,
    active: true,
    ...overrides,
  };
}

function baseDeps(overrides: Partial<PrepareOrderDeps> = {}): PrepareOrderDeps {
  const products = [simpleProduct(), empanadasProduct()];
  return {
    now: () => NOW,
    findMerchantById: vi.fn(async () => merchant()),
    listProductsByIds: vi.fn(async (ids) =>
      products.filter((row) => ids.includes(row.id)),
    ),
    listOptionGroupsForProducts: vi.fn(async (ids) =>
      [saboresGroup].filter((row) => ids.includes(row.productId)),
    ),
    listOptionChoicesForGroups: vi.fn(async (ids) =>
      saboresChoices.filter((row) => ids.includes(row.groupId)),
    ),
    listPaymentMethodsForMerchant: vi.fn(async () => [cashPayment()]),
    listDeliveryZonesForMerchant: vi.fn(async () => [deliveryZone()]),
    ...overrides,
  };
}

function pickupInput(
  overrides: Partial<PrepareOrderInput> = {},
): PrepareOrderInput {
  return {
    merchantId: MERCHANT_ID,
    customerZoneId: ZONE_HOME_ID,
    customer: { name: "Ana López", phone: "2804123456" },
    fulfillmentMethod: "PICKUP",
    paymentMethodCode: "CASH",
    idempotencyKey: "checkout-retry-key-01",
    lines: [{ productId: PROD_SIMPLE_ID, quantity: 1 }],
    ...overrides,
  };
}

function deliveryInput(): PrepareOrderInput {
  return pickupInput({
    fulfillmentMethod: "MERCHANT_DELIVERY",
    delivery: {
      zoneId: ZONE_DELIVERY_ID,
      street: "San Martín",
      number: "123",
    },
  });
}

async function prepared(
  input: PrepareOrderInput = pickupInput(),
  deps: PrepareOrderDeps = baseDeps(),
): Promise<PreparedOrder> {
  const result = await prepareOrder(input, deps);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected prepared order");
  }
  return result.value;
}

describe("authoritative checkout review", () => {
  it("ignores browser prices and names when reviewing", async () => {
    const result = await reviewCheckout(
      pickupInput({
        lines: [{ productId: PROD_SIMPLE_ID, quantity: 2 }],
      }),
      baseDeps(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.merchantName).toBe("Empanadas Rawson");
    expect(result.value.lines[0]?.productName).toBe("Coca 2L");
    expect(result.value.lines[0]?.unitPriceCents).toBe(100000);
    expect(result.value.totalCents).toBe(200000);
    expect(Number.isInteger(result.value.totalCents)).toBe(true);
  });

  it("calculates an authoritative delivery fee and total", async () => {
    const result = await reviewCheckout(deliveryInput(), baseDeps());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.deliveryFeeCents).toBe(15000);
    expect(result.value.totalCents).toBe(115000);
    expect(result.value.delivery?.zoneName).toBe("Barrio Norte");
  });
});

describe("quote fingerprint", () => {
  it("is deterministic for the same authoritative quote", async () => {
    const order = await prepared();
    const first = buildQuoteFingerprint(order);
    const second = buildQuoteFingerprint(order);
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(toCheckoutReview(order).quoteFingerprint).toBe(first);
  });

  it("does not change when line order changes", async () => {
    const order = await prepared(
      pickupInput({
        lines: [
          { productId: PROD_SIMPLE_ID, quantity: 1 },
          {
            productId: PROD_EMPANADAS_ID,
            quantity: 1,
            groups: [
              {
                groupId: GROUP_SABORES_ID,
                selections: [
                  { choiceId: CHOICE_CARNE_ID, quantity: 6 },
                  { choiceId: CHOICE_JYQ_ID, quantity: 3 },
                  { choiceId: CHOICE_VERDURA_ID, quantity: 3 },
                ],
              },
            ],
          },
        ],
      }),
    );
    const reversed: PreparedOrder = {
      ...order,
      lines: [...order.lines].reverse(),
    };
    expect(buildQuoteFingerprint(reversed)).toBe(buildQuoteFingerprint(order));
    expect(
      canonicalQuotePayload(reversed).lines.map((line) => line.productId),
    ).toEqual(canonicalQuotePayload(order).lines.map((line) => line.productId));
  });

  it("changes when an authoritative price changes", async () => {
    const order = await prepared();
    const mutated: PreparedOrder = {
      ...order,
      lines: order.lines.map((line) => ({
        ...line,
        unitPriceCents: moneyCents(line.unitPriceCents + 5000),
      })),
      totalCents: moneyCents(order.totalCents + 5000),
    };
    expect(buildQuoteFingerprint(mutated)).not.toBe(
      buildQuoteFingerprint(order),
    );
  });

  it("changes when an option delta changes", async () => {
    const order = await prepared(
      pickupInput({
        lines: [
          {
            productId: PROD_EMPANADAS_ID,
            quantity: 1,
            groups: [
              {
                groupId: GROUP_SABORES_ID,
                selections: [
                  { choiceId: CHOICE_CARNE_ID, quantity: 6 },
                  { choiceId: CHOICE_JYQ_ID, quantity: 3 },
                  { choiceId: CHOICE_VERDURA_ID, quantity: 3 },
                ],
              },
            ],
          },
        ],
      }),
    );
    const mutated: PreparedOrder = {
      ...order,
      lines: order.lines.map((line) => ({
        ...line,
        options: line.options.map((option, index) =>
          index === 1
            ? {
                ...option,
                priceDeltaCents: moneyCents(option.priceDeltaCents + 100),
              }
            : option,
        ),
      })),
    };
    expect(buildQuoteFingerprint(mutated)).not.toBe(
      buildQuoteFingerprint(order),
    );
  });

  it("changes when the delivery fee changes", async () => {
    const order = await prepared(deliveryInput());
    const mutated: PreparedOrder = {
      ...order,
      deliveryFeeCents: moneyCents(order.deliveryFeeCents + 1000),
      totalCents: moneyCents(order.totalCents + 1000),
    };
    expect(buildQuoteFingerprint(mutated)).not.toBe(
      buildQuoteFingerprint(order),
    );
  });

  it("changes when payment instructions change", async () => {
    const order = await prepared();
    const mutated: PreparedOrder = {
      ...order,
      paymentMethodSnapshot: {
        ...order.paymentMethodSnapshot,
        instructions: "Nuevas instrucciones",
      },
    };
    expect(buildQuoteFingerprint(mutated)).not.toBe(
      buildQuoteFingerprint(order),
    );
  });
});
