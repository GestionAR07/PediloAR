import { describe, expect, it } from "vitest";
import { moneyCents } from "@/domain/money/money-cents";
import {
  addProductToCart,
  clearCart,
  removeCartLine,
  replaceCartWithProduct,
  resolveStockCap,
  setCartLineQuantity,
} from "./cart-operations";
import { buildConfigurationSignature } from "./configuration-signature";
import {
  calculateCartBadgeCount,
  calculateCartLineTotalCents,
  calculateCartTotalCents,
  calculateConfiguredUnitPriceCents,
} from "./pricing";
import { emptyCart, type CartGroupConfiguration } from "./types";
import {
  buildCartConfigurationFromDraft,
  formatConfigurationSummary,
  isConfiguratorSelectionValid,
} from "./validate-configuration";

const MERCHANT_A = "merchant-a";
const MERCHANT_B = "merchant-b";

function quantityDozenConfig(
  carne = 6,
  jyq = 3,
  verdura = 3,
): CartGroupConfiguration[] {
  return [
    {
      groupId: "sabores",
      groupName: "Sabores",
      selectionMode: "QUANTITY",
      selections: [
        {
          choiceId: "carne",
          choiceName: "Carne",
          quantity: carne,
          priceDeltaCents: moneyCents(0),
        },
        {
          choiceId: "jyq",
          choiceName: "Jamón y queso",
          quantity: jyq,
          priceDeltaCents: moneyCents(0),
        },
        {
          choiceId: "verdura",
          choiceName: "Verdura",
          quantity: verdura,
          priceDeltaCents: moneyCents(0),
        },
      ].filter((selection) => selection.quantity > 0),
    },
  ];
}

describe("configuration signature", () => {
  it("is deterministic regardless of group/choice order", () => {
    const a = buildConfigurationSignature("p1", [
      {
        groupId: "g2",
        groupName: "B",
        selectionMode: "MULTIPLE",
        selections: [
          {
            choiceId: "c2",
            choiceName: "Two",
            quantity: 1,
            priceDeltaCents: moneyCents(100),
          },
          {
            choiceId: "c1",
            choiceName: "One",
            quantity: 1,
            priceDeltaCents: moneyCents(50),
          },
        ],
      },
      {
        groupId: "g1",
        groupName: "A",
        selectionMode: "SINGLE",
        selections: [
          {
            choiceId: "x",
            choiceName: "X",
            quantity: 1,
            priceDeltaCents: moneyCents(0),
          },
        ],
      },
    ]);
    const b = buildConfigurationSignature("p1", [
      {
        groupId: "g1",
        groupName: "A",
        selectionMode: "SINGLE",
        selections: [
          {
            choiceId: "x",
            choiceName: "X",
            quantity: 1,
            priceDeltaCents: moneyCents(0),
          },
        ],
      },
      {
        groupId: "g2",
        groupName: "B",
        selectionMode: "MULTIPLE",
        selections: [
          {
            choiceId: "c1",
            choiceName: "One",
            quantity: 1,
            priceDeltaCents: moneyCents(50),
          },
          {
            choiceId: "c2",
            choiceName: "Two",
            quantity: 1,
            priceDeltaCents: moneyCents(100),
          },
        ],
      },
    ]);
    expect(a).toBe(b);
  });
});

describe("MoneyCents cart pricing", () => {
  it("applies SINGLE price delta", () => {
    const unit = calculateConfiguredUnitPriceCents(1000, [
      {
        groupId: "size",
        groupName: "Tamaño",
        selectionMode: "SINGLE",
        selections: [
          {
            choiceId: "xl",
            choiceName: "XL",
            quantity: 1,
            priceDeltaCents: moneyCents(200),
          },
        ],
      },
    ]);
    expect(unit).toBe(1200);
  });

  it("sums MULTIPLE price deltas", () => {
    const unit = calculateConfiguredUnitPriceCents(1000, [
      {
        groupId: "extras",
        groupName: "Extras",
        selectionMode: "MULTIPLE",
        selections: [
          {
            choiceId: "a",
            choiceName: "A",
            quantity: 1,
            priceDeltaCents: moneyCents(50),
          },
          {
            choiceId: "b",
            choiceName: "B",
            quantity: 1,
            priceDeltaCents: moneyCents(75),
          },
        ],
      },
    ]);
    expect(unit).toBe(1125);
  });

  it("multiplies QUANTITY deltas by choice units", () => {
    const unit = calculateConfiguredUnitPriceCents(250000, [
      {
        groupId: "sabores",
        groupName: "Sabores",
        selectionMode: "QUANTITY",
        selections: [
          {
            choiceId: "premium",
            choiceName: "Premium",
            quantity: 4,
            priceDeltaCents: moneyCents(100),
          },
        ],
      },
    ]);
    expect(unit).toBe(250400);
  });
});

describe("configurator validation", () => {
  const dozenGroup = {
    id: "sabores",
    name: "Sabores",
    selectionMode: "QUANTITY" as const,
    minSelections: 12,
    maxSelections: 12,
    choices: [
      { id: "carne", name: "Carne", priceDeltaCents: 0 },
      { id: "jyq", name: "Jamón y queso", priceDeltaCents: 0 },
      { id: "verdura", name: "Verdura", priceDeltaCents: 0 },
    ],
  };

  it("rejects QUANTITY 0/12 and accepts exact 12/12", () => {
    expect(
      isConfiguratorSelectionValid(
        [dozenGroup],
        [{ groupId: "sabores", selections: [] }],
      ),
    ).toBe(false);
    expect(
      isConfiguratorSelectionValid(
        [dozenGroup],
        [
          {
            groupId: "sabores",
            selections: [
              { choiceId: "carne", quantity: 6 },
              { choiceId: "jyq", quantity: 3 },
              { choiceId: "verdura", quantity: 3 },
            ],
          },
        ],
      ),
    ).toBe(true);
  });

  it("supports flexible QUANTITY bounds and blocks over max / negative via draft builder", () => {
    const flexible = {
      ...dozenGroup,
      minSelections: 1,
      maxSelections: 24,
    };
    expect(
      isConfiguratorSelectionValid(
        [flexible],
        [
          {
            groupId: "sabores",
            selections: [{ choiceId: "carne", quantity: 10 }],
          },
        ],
      ),
    ).toBe(true);
    expect(
      isConfiguratorSelectionValid(
        [flexible],
        [
          {
            groupId: "sabores",
            selections: [{ choiceId: "carne", quantity: 25 }],
          },
        ],
      ),
    ).toBe(false);
  });

  it("validates SINGLE required/optional and MULTIPLE min/max", () => {
    const singleRequired = {
      id: "size",
      name: "Tamaño",
      selectionMode: "SINGLE",
      minSelections: 1,
      maxSelections: 1,
      choices: [{ id: "m", name: "M", priceDeltaCents: 0 }],
    };
    expect(
      isConfiguratorSelectionValid(
        [singleRequired],
        [{ groupId: "size", selections: [] }],
      ),
    ).toBe(false);
    expect(
      isConfiguratorSelectionValid(
        [singleRequired],
        [{ groupId: "size", selections: [{ choiceId: "m", quantity: 1 }] }],
      ),
    ).toBe(true);

    const multiple = {
      id: "extras",
      name: "Extras",
      selectionMode: "MULTIPLE",
      minSelections: 1,
      maxSelections: 2,
      choices: [
        { id: "a", name: "A", priceDeltaCents: 10 },
        { id: "b", name: "B", priceDeltaCents: 20 },
        { id: "c", name: "C", priceDeltaCents: 30 },
      ],
    };
    expect(
      isConfiguratorSelectionValid(
        [multiple],
        [{ groupId: "extras", selections: [] }],
      ),
    ).toBe(false);
    expect(
      isConfiguratorSelectionValid(
        [multiple],
        [
          {
            groupId: "extras",
            selections: [
              { choiceId: "a", quantity: 1 },
              { choiceId: "b", quantity: 1 },
              { choiceId: "c", quantity: 1 },
            ],
          },
        ],
      ),
    ).toBe(false);
    expect(
      isConfiguratorSelectionValid(
        [multiple],
        [
          {
            groupId: "extras",
            selections: [
              { choiceId: "a", quantity: 1 },
              { choiceId: "b", quantity: 1 },
            ],
          },
        ],
      ),
    ).toBe(true);
  });
});

describe("cart operations", () => {
  it("starts empty and adds a simple product", () => {
    const result = addProductToCart(emptyCart(), {
      merchantId: MERCHANT_A,
      merchantNameSnapshot: "Comercio A",
      productId: "simple",
      productNameSnapshot: "Agua",
      basePriceCents: 500,
      configuration: [],
      createLineId: () => "line-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cart.lines).toHaveLength(1);
    expect(result.cart.lines[0]?.quantity).toBe(1);
    expect(calculateCartBadgeCount(result.cart.lines)).toBe(1);
  });

  it("enforces single-merchant conflict and replace confirmation", () => {
    const first = addProductToCart(emptyCart(), {
      merchantId: MERCHANT_A,
      merchantNameSnapshot: "Comercio A",
      productId: "a1",
      productNameSnapshot: "Prod A",
      basePriceCents: 100,
      configuration: [],
      createLineId: () => "l1",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const conflict = addProductToCart(first.cart, {
      merchantId: MERCHANT_B,
      merchantNameSnapshot: "Comercio B",
      productId: "b1",
      productNameSnapshot: "Prod B",
      basePriceCents: 200,
      configuration: [],
      createLineId: () => "l2",
    });
    expect(conflict.ok).toBe(false);
    if (conflict.ok) return;
    expect(conflict.reason).toBe("merchant_conflict");

    const replaced = replaceCartWithProduct({
      merchantId: MERCHANT_B,
      merchantNameSnapshot: "Comercio B",
      productId: "b1",
      productNameSnapshot: "Prod B",
      basePriceCents: 200,
      configuration: [],
      createLineId: () => "l2",
    });
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) return;
    expect(replaced.cart.merchantId).toBe(MERCHANT_B);
    expect(replaced.cart.lines).toHaveLength(1);
  });

  it("merges same configuration and keeps different configs as separate lines", () => {
    let cart = emptyCart();
    const mixed = quantityDozenConfig(6, 3, 3);
    const allCarne: CartGroupConfiguration[] = [
      {
        groupId: "sabores",
        groupName: "Sabores",
        selectionMode: "QUANTITY",
        selections: [
          {
            choiceId: "carne",
            choiceName: "Carne",
            quantity: 12,
            priceDeltaCents: moneyCents(0),
          },
        ],
      },
    ];

    const add1 = addProductToCart(cart, {
      merchantId: MERCHANT_A,
      merchantNameSnapshot: "Empanadas SA",
      productId: "empanadas",
      productNameSnapshot: "Empanadas",
      basePriceCents: 250000,
      configuration: mixed,
      createLineId: () => "line-mixed",
    });
    expect(add1.ok).toBe(true);
    if (!add1.ok) return;
    cart = add1.cart;
    expect(calculateCartBadgeCount(cart.lines)).toBe(1);

    const add2 = addProductToCart(cart, {
      merchantId: MERCHANT_A,
      merchantNameSnapshot: "Empanadas SA",
      productId: "empanadas",
      productNameSnapshot: "Empanadas",
      basePriceCents: 250000,
      configuration: mixed,
      createLineId: () => "should-not-use",
    });
    expect(add2.ok).toBe(true);
    if (!add2.ok) return;
    cart = add2.cart;
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]?.quantity).toBe(2);
    expect(calculateCartBadgeCount(cart.lines)).toBe(2);

    const add3 = addProductToCart(cart, {
      merchantId: MERCHANT_A,
      merchantNameSnapshot: "Empanadas SA",
      productId: "empanadas",
      productNameSnapshot: "Empanadas",
      basePriceCents: 250000,
      configuration: allCarne,
      createLineId: () => "line-carne",
    });
    expect(add3.ok).toBe(true);
    if (!add3.ok) return;
    cart = add3.cart;
    expect(cart.lines).toHaveLength(2);
    expect(calculateCartBadgeCount(cart.lines)).toBe(3);
    expect(calculateCartTotalCents(cart.lines)).toBe(750000);

    const readable = formatConfigurationSummary(mixed);
    expect(readable[0]).toContain("6 Carne");
    expect(readable[0]).toContain("3 Jamón y queso");
    expect(readable[0]).toContain("3 Verdura");
  });

  it("increments, decrements, removes lines and clears cart", () => {
    const added = addProductToCart(emptyCart(), {
      merchantId: MERCHANT_A,
      merchantNameSnapshot: "A",
      productId: "p",
      productNameSnapshot: "P",
      basePriceCents: 1000,
      configuration: [],
      createLineId: () => "line-1",
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    let cart = setCartLineQuantity(added.cart, "line-1", 3);
    expect(cart.lines[0]?.quantity).toBe(3);
    cart = setCartLineQuantity(cart, "line-1", 1);
    expect(cart.lines[0]?.quantity).toBe(1);
    cart = removeCartLine(cart, "line-1");
    expect(cart.lines).toHaveLength(0);
    cart = clearCart();
    expect(cart.merchantId).toBe("");
  });

  it("caps TRACKED stock UX and refuses stock 0 adds", () => {
    expect(resolveStockCap("TRACKED", 2)).toBe(2);
    expect(resolveStockCap("NOT_TRACKED", 2)).toBeNull();

    const blocked = addProductToCart(emptyCart(), {
      merchantId: MERCHANT_A,
      merchantNameSnapshot: "A",
      productId: "p",
      productNameSnapshot: "P",
      basePriceCents: 100,
      configuration: [],
      stockCap: 0,
      createLineId: () => "l",
    });
    expect(blocked.ok).toBe(false);

    const first = addProductToCart(emptyCart(), {
      merchantId: MERCHANT_A,
      merchantNameSnapshot: "A",
      productId: "p",
      productNameSnapshot: "P",
      basePriceCents: 100,
      configuration: [],
      stockCap: 2,
      createLineId: () => "l",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = addProductToCart(first.cart, {
      merchantId: MERCHANT_A,
      merchantNameSnapshot: "A",
      productId: "p",
      productNameSnapshot: "P",
      basePriceCents: 100,
      configuration: [],
      stockCap: 2,
      createLineId: () => "l2",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.cart.lines[0]?.quantity).toBe(2);
    const third = addProductToCart(second.cart, {
      merchantId: MERCHANT_A,
      merchantNameSnapshot: "A",
      productId: "p",
      productNameSnapshot: "P",
      basePriceCents: 100,
      configuration: [],
      stockCap: 2,
      createLineId: () => "l3",
    });
    expect(third.ok).toBe(true);
    if (!third.ok) return;
    expect(third.cart.lines[0]?.quantity).toBe(2);

    const capped = setCartLineQuantity(third.cart, "l", 9, 2);
    expect(capped.lines[0]?.quantity).toBe(2);
  });

  it("builds configuration from draft for pricing identity", () => {
    const config = buildCartConfigurationFromDraft(
      [
        {
          id: "sabores",
          name: "Sabores",
          selectionMode: "QUANTITY",
          minSelections: 12,
          maxSelections: 12,
          choices: [
            { id: "carne", name: "Carne", priceDeltaCents: 0 },
            { id: "jyq", name: "Jamón y queso", priceDeltaCents: 0 },
            { id: "verdura", name: "Verdura", priceDeltaCents: 0 },
          ],
        },
      ],
      [
        {
          groupId: "sabores",
          selections: [
            { choiceId: "carne", quantity: 6 },
            { choiceId: "jyq", quantity: 3 },
            { choiceId: "verdura", quantity: 3 },
          ],
        },
      ],
    );
    const lineTotal = calculateCartLineTotalCents({
      id: "x",
      productId: "empanadas",
      productNameSnapshot: "Empanadas",
      basePriceCentsSnapshot: moneyCents(250000),
      quantity: 1,
      configuration: config,
      unitPriceCentsSnapshot: calculateConfiguredUnitPriceCents(250000, config),
      configurationSignature: buildConfigurationSignature("empanadas", config),
    });
    expect(lineTotal).toBe(250000);
  });
});
