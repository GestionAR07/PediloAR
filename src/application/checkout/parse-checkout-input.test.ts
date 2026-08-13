import { describe, expect, it } from "vitest";
import { moneyCents } from "@/domain/money/money-cents";
import { CART_SCHEMA_VERSION, type Cart } from "@/domain/cart/types";
import { CHECKOUT_ERROR_CODES } from "./errors";
import {
  checkoutRequestSignature,
  mapCartToPrepareLines,
  parseCheckoutInput,
  type CheckoutFormDraft,
} from "./parse-checkout-input";

const MERCHANT_ID = "11111111-1111-4111-8111-111111111111";
const ZONE_HOME_ID = "44444444-4444-4444-8444-444444444444";
const ZONE_DELIVERY_ID = "55555555-5555-4555-8555-555555555555";
const PROD_SIMPLE_ID = "77777777-7777-4777-8777-777777777777";
const PROD_EMPANADAS_ID = "88888888-8888-4888-8888-888888888888";
const GROUP_SABORES_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CHOICE_CARNE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CHOICE_JYQ_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const CHOICE_VERDURA_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function draft(overrides: Partial<CheckoutFormDraft> = {}): CheckoutFormDraft {
  return {
    merchantId: MERCHANT_ID,
    customerZoneId: ZONE_HOME_ID,
    customerName: "Ana",
    customerPhone: "2804123456",
    fulfillmentMethod: "PICKUP",
    deliveryZoneId: "",
    street: "",
    number: "",
    floorApartment: "",
    reference: "",
    paymentMethodCode: "CASH",
    idempotencyKey: "checkout-retry-key-01",
    ...overrides,
  };
}

function simpleCart(quantity = 1): Cart {
  return {
    version: CART_SCHEMA_VERSION,
    merchantId: MERCHANT_ID,
    merchantNameSnapshot: "Nombre falso del browser",
    lines: [
      {
        id: "line-1",
        productId: PROD_SIMPLE_ID,
        productNameSnapshot: "Nombre falso",
        basePriceCentsSnapshot: moneyCents(1),
        quantity,
        configuration: [],
        unitPriceCentsSnapshot: moneyCents(1),
        configurationSignature: "sig",
      },
    ],
  };
}

function empanadasCart(): Cart {
  return {
    version: CART_SCHEMA_VERSION,
    merchantId: MERCHANT_ID,
    merchantNameSnapshot: "Fake merchant",
    lines: [
      {
        id: "line-emp",
        productId: PROD_EMPANADAS_ID,
        productNameSnapshot: "Fake dozen",
        basePriceCentsSnapshot: moneyCents(1),
        quantity: 2,
        configuration: [
          {
            groupId: GROUP_SABORES_ID,
            groupName: "Sabores fake",
            selectionMode: "QUANTITY",
            selections: [
              {
                choiceId: CHOICE_CARNE_ID,
                choiceName: "Fake carne",
                quantity: 6,
                priceDeltaCents: moneyCents(99),
              },
              {
                choiceId: CHOICE_JYQ_ID,
                choiceName: "Fake jyq",
                quantity: 3,
                priceDeltaCents: moneyCents(99),
              },
              {
                choiceId: CHOICE_VERDURA_ID,
                choiceName: "Fake verdura",
                quantity: 3,
                priceDeltaCents: moneyCents(99),
              },
            ],
          },
        ],
        unitPriceCentsSnapshot: moneyCents(1),
        configurationSignature: "emp-sig",
      },
    ],
  };
}

describe("checkout cart mapping", () => {
  it("maps QUANTITY 6/3/3 as one line with option quantities, ignoring browser prices", () => {
    const lines = mapCartToPrepareLines(empanadasCart());
    expect(lines).toEqual([
      {
        productId: PROD_EMPANADAS_ID,
        quantity: 2,
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
    ]);
    expect(JSON.stringify(lines)).not.toContain("Fake");
    expect(JSON.stringify(lines)).not.toContain("99");
  });

  it("rejects an empty cart", () => {
    const result = parseCheckoutInput(
      {
        version: CART_SCHEMA_VERSION,
        merchantId: "",
        merchantNameSnapshot: "",
        lines: [],
      },
      draft(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(CHECKOUT_ERROR_CODES.EMPTY_CART);
  });

  it("does not require an address for pickup", () => {
    const result = parseCheckoutInput(simpleCart(), draft());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.fulfillmentMethod).toBe("PICKUP");
    expect(result.value.delivery).toBeNull();
  });

  it("requires zone and address for merchant delivery", () => {
    const missing = parseCheckoutInput(
      simpleCart(),
      draft({ fulfillmentMethod: "MERCHANT_DELIVERY" }),
    );
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error.code).toBe(
      CHECKOUT_ERROR_CODES.DELIVERY_ZONE_REQUIRED,
    );

    const noStreet = parseCheckoutInput(
      simpleCart(),
      draft({
        fulfillmentMethod: "MERCHANT_DELIVERY",
        deliveryZoneId: ZONE_DELIVERY_ID,
        street: "",
        number: "123",
      }),
    );
    expect(noStreet.ok).toBe(false);
    if (noStreet.ok) return;
    expect(noStreet.error.code).toBe(
      CHECKOUT_ERROR_CODES.DELIVERY_ADDRESS_REQUIRED,
    );

    const okResult = parseCheckoutInput(
      simpleCart(),
      draft({
        fulfillmentMethod: "MERCHANT_DELIVERY",
        deliveryZoneId: ZONE_DELIVERY_ID,
        street: "San Martín",
        number: "123",
      }),
    );
    expect(okResult.ok).toBe(true);
    if (!okResult.ok) return;
    expect(okResult.value.delivery?.zoneId).toBe(ZONE_DELIVERY_ID);
  });

  it("changes the request signature when payment or fulfillment changes", () => {
    const cart = simpleCart();
    const base = checkoutRequestSignature(cart, draft());
    const payment = checkoutRequestSignature(
      cart,
      draft({ paymentMethodCode: "TRANSFER" }),
    );
    const fulfillment = checkoutRequestSignature(
      cart,
      draft({
        fulfillmentMethod: "MERCHANT_DELIVERY",
        deliveryZoneId: ZONE_DELIVERY_ID,
      }),
    );
    expect(payment).not.toBe(base);
    expect(fulfillment).not.toBe(base);
  });
});
