import { describe, expect, it, vi } from "vitest";
import { CHECKOUT_ERROR_CODES } from "./errors";
import { prepareOrder } from "./prepare-order";
import type {
  CheckoutDeliveryZoneRecord,
  CheckoutMerchantRecord,
  CheckoutOptionChoiceRecord,
  CheckoutOptionGroupRecord,
  CheckoutPaymentMethodRecord,
  CheckoutProductRecord,
  PrepareOrderDeps,
  PrepareOrderInput,
} from "./types";

const NOW = new Date("2026-08-13T12:00:00.000Z");
const MERCHANT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_MERCHANT_ID = "22222222-2222-4222-8222-222222222222";
const CITY_ID = "33333333-3333-4333-8333-333333333333";
const ZONE_HOME_ID = "44444444-4444-4444-8444-444444444444";
const ZONE_DELIVERY_ID = "55555555-5555-4555-8555-555555555555";
const ZONE_FOREIGN_ID = "66666666-6666-4666-8666-666666666666";
const PROD_SIMPLE_ID = "77777777-7777-4777-8777-777777777777";
const PROD_EMPANADAS_ID = "88888888-8888-4888-8888-888888888888";
const PROD_OTHER_ID = "99999999-9999-4999-8999-999999999999";
const PROD_MISSING_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROD_TRACKED_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const GROUP_SABORES_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CHOICE_CARNE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CHOICE_JYQ_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const CHOICE_VERDURA_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const GROUP_SINGLE_ID = "12121212-1212-4121-8121-121212121212";
const CHOICE_GRANDE_ID = "13131313-1313-4131-8131-131313131313";
const CHOICE_CHICA_ID = "14141414-1414-4141-8141-141414141414";
const GROUP_MULTI_ID = "15151515-1515-4151-8151-151515151515";
const CHOICE_EXTRA_A_ID = "16161616-1616-4161-8161-161616161616";
const CHOICE_EXTRA_B_ID = "17171717-1717-4171-8171-171717171717";
const CHOICE_EXTRA_C_ID = "18181818-1818-4181-8181-181818181818";
const GROUP_FOREIGN_ID = "19191919-1919-4191-8191-191919191919";
const CHOICE_FOREIGN_ID = "1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a";
const CHOICE_INACTIVE_ID = "1b1b1b1b-1b1b-41b1-81b1-1b1b1b1b1b1b";
const IDEMPOTENCY_KEY = "checkout-retry-key-01";

function merchant(
  overrides: Partial<CheckoutMerchantRecord> = {},
): CheckoutMerchantRecord {
  return {
    id: MERCHANT_ID,
    name: "Empanadas Rawson",
    status: "ACTIVE",
    cityId: CITY_ID,
    cityName: "Rawson",
    zoneId: ZONE_HOME_ID,
    zoneName: "Centro",
    pickupEnabled: true,
    merchantDeliveryEnabled: true,
    platformDeliveryEnabled: false,
    acceptingOrders: true,
    pausedUntil: null,
    ...overrides,
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

function empanadasProduct(
  overrides: Partial<CheckoutProductRecord> = {},
): CheckoutProductRecord {
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
    ...overrides,
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
    cityId: CITY_ID,
    cityName: "Rawson",
    deliveryFeeCents: 15000,
    minimumOrderCents: 100000,
    estimatedMinutes: 40,
    active: true,
    ...overrides,
  };
}

const dozenSelections = [
  { choiceId: CHOICE_CARNE_ID, quantity: 6 },
  { choiceId: CHOICE_JYQ_ID, quantity: 3 },
  { choiceId: CHOICE_VERDURA_ID, quantity: 3 },
];

function pickupInput(
  overrides: Partial<PrepareOrderInput> = {},
): PrepareOrderInput {
  return {
    merchantId: MERCHANT_ID,
    customerZoneId: ZONE_HOME_ID,
    customer: { name: "Ana López", phone: "2804123456" },
    fulfillmentMethod: "PICKUP",
    paymentMethodCode: "CASH",
    idempotencyKey: IDEMPOTENCY_KEY,
    lines: [{ productId: PROD_SIMPLE_ID, quantity: 1 }],
    ...overrides,
  };
}

function deliveryInput(
  overrides: Partial<PrepareOrderInput> = {},
): PrepareOrderInput {
  return pickupInput({
    fulfillmentMethod: "MERCHANT_DELIVERY",
    customerZoneId: ZONE_HOME_ID,
    delivery: {
      zoneId: ZONE_DELIVERY_ID,
      street: "San Martín",
      number: "123",
      floorApartment: "2A",
      reference: "Timbre verde",
    },
    ...overrides,
  });
}

function empanadasLine(selections = dozenSelections) {
  return {
    productId: PROD_EMPANADAS_ID,
    quantity: 1,
    groups: [{ groupId: GROUP_SABORES_ID, selections }],
  };
}

function baseDeps(overrides: Partial<PrepareOrderDeps> = {}): PrepareOrderDeps {
  const merchants = [merchant()];
  const products = [
    simpleProduct(),
    empanadasProduct(),
    simpleProduct({
      id: PROD_OTHER_ID,
      merchantId: OTHER_MERCHANT_ID,
      name: "Ajeno",
    }),
    simpleProduct({
      id: PROD_TRACKED_ID,
      name: "Stockeado",
      stockMode: "TRACKED",
      stockQuantity: 5,
    }),
  ];
  const groups = [saboresGroup];
  const choices = [...saboresChoices];
  const payments = [
    cashPayment(),
    {
      code: "TRANSFER",
      label: "Transferencia",
      instructions: "Alias comercio",
      active: false,
    },
  ];
  const zones = [deliveryZone()];

  return {
    now: () => NOW,
    findMerchantById: vi.fn(
      async (id) => merchants.find((row) => row.id === id) ?? null,
    ),
    listProductsByIds: vi.fn(async (ids) =>
      products.filter((row) => ids.includes(row.id)),
    ),
    listOptionGroupsForProducts: vi.fn(async (ids) =>
      groups.filter((row) => ids.includes(row.productId)),
    ),
    listOptionChoicesForGroups: vi.fn(async (ids) =>
      choices.filter((row) => ids.includes(row.groupId)),
    ),
    listPaymentMethodsForMerchant: vi.fn(async (merchantId) =>
      merchantId === MERCHANT_ID ? payments : [],
    ),
    listDeliveryZonesForMerchant: vi.fn(async (merchantId) =>
      merchantId === MERCHANT_ID ? zones : [],
    ),
    ...overrides,
  };
}

function withCatalog(options: {
  merchant?: CheckoutMerchantRecord | null;
  products?: CheckoutProductRecord[];
  groups?: CheckoutOptionGroupRecord[];
  choices?: CheckoutOptionChoiceRecord[];
  payments?: CheckoutPaymentMethodRecord[];
  zones?: CheckoutDeliveryZoneRecord[];
}): PrepareOrderDeps {
  const merchantRow =
    options.merchant === undefined ? merchant() : options.merchant;
  return baseDeps({
    findMerchantById: vi.fn(async () => merchantRow),
    listProductsByIds: vi.fn(async (ids) =>
      (options.products ?? [simpleProduct(), empanadasProduct()]).filter(
        (row) => ids.includes(row.id),
      ),
    ),
    listOptionGroupsForProducts: vi.fn(async (ids) =>
      (options.groups ?? [saboresGroup]).filter((row) =>
        ids.includes(row.productId),
      ),
    ),
    listOptionChoicesForGroups: vi.fn(async (ids) =>
      (options.choices ?? saboresChoices).filter((row) =>
        ids.includes(row.groupId),
      ),
    ),
    listPaymentMethodsForMerchant: vi.fn(
      async () => options.payments ?? [cashPayment()],
    ),
    listDeliveryZonesForMerchant: vi.fn(
      async () => options.zones ?? [deliveryZone()],
    ),
  });
}

async function expectCode(
  input: PrepareOrderInput,
  deps: PrepareOrderDeps,
  code: string,
) {
  const result = await prepareOrder(input, deps);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe(code);
  }
}

describe("prepareOrder happy paths", () => {
  it("prepares a valid pickup order with fee 0 and no address", async () => {
    const result = await prepareOrder(pickupInput(), baseDeps());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.fulfillmentMethod).toBe("PICKUP");
    expect(result.value.deliveryFeeCents).toBe(0);
    expect(result.value.delivery).toBeNull();
    expect(result.value.customerUserId).toBeNull();
    expect(result.value.customerNameSnapshot).toBe("Ana López");
    expect(result.value.merchantNameSnapshot).toBe("Empanadas Rawson");
    expect(result.value.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(result.value.totalCents).toBe(100000);
  });

  it("prepares a valid merchant delivery order from DB fee and zone names", async () => {
    const result = await prepareOrder(deliveryInput(), baseDeps());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.fulfillmentMethod).toBe("MERCHANT_DELIVERY");
    expect(result.value.deliveryFeeCents).toBe(15000);
    expect(result.value.delivery).toEqual({
      cityId: CITY_ID,
      zoneId: ZONE_DELIVERY_ID,
      cityNameSnapshot: "Rawson",
      zoneNameSnapshot: "Barrio Norte",
      street: "San Martín",
      number: "123",
      floorApartment: "2A",
      reference: "Timbre verde",
      feeCents: 15000,
      estimatedMinutes: 40,
    });
    expect(result.value.totalCents).toBe(115000);
  });
});

describe("prepareOrder merchant", () => {
  it("rejects a missing merchant", async () => {
    await expectCode(
      pickupInput(),
      withCatalog({ merchant: null }),
      CHECKOUT_ERROR_CODES.MERCHANT_NOT_FOUND,
    );
  });

  it("rejects DRAFT", async () => {
    await expectCode(
      pickupInput(),
      withCatalog({ merchant: merchant({ status: "DRAFT" }) }),
      CHECKOUT_ERROR_CODES.MERCHANT_NOT_ACCEPTING,
    );
  });

  it("rejects SUSPENDED", async () => {
    await expectCode(
      pickupInput(),
      withCatalog({ merchant: merchant({ status: "SUSPENDED" }) }),
      CHECKOUT_ERROR_CODES.MERCHANT_NOT_ACCEPTING,
    );
  });

  it("rejects ACTIVE paused (pausedUntil in the future)", async () => {
    await expectCode(
      pickupInput(),
      withCatalog({
        merchant: merchant({
          pausedUntil: new Date("2026-08-13T13:00:00.000Z"),
        }),
      }),
      CHECKOUT_ERROR_CODES.MERCHANT_NOT_ACCEPTING,
    );
  });

  it("allows ACTIVE after a pause that already expired", async () => {
    const result = await prepareOrder(
      pickupInput(),
      withCatalog({
        merchant: merchant({
          pausedUntil: new Date("2026-08-13T11:00:00.000Z"),
        }),
      }),
    );
    expect(result.ok).toBe(true);
  });
});

describe("prepareOrder products and stock precheck", () => {
  it("rejects a missing product", async () => {
    await expectCode(
      pickupInput({ lines: [{ productId: PROD_MISSING_ID, quantity: 1 }] }),
      baseDeps(),
      CHECKOUT_ERROR_CODES.PRODUCT_NOT_FOUND,
    );
  });

  it("rejects a product from another merchant", async () => {
    await expectCode(
      pickupInput({ lines: [{ productId: PROD_OTHER_ID, quantity: 1 }] }),
      baseDeps(),
      CHECKOUT_ERROR_CODES.PRODUCT_FOREIGN_MERCHANT,
    );
  });

  it("rejects active=false", async () => {
    await expectCode(
      pickupInput(),
      withCatalog({ products: [simpleProduct({ active: false })] }),
      CHECKOUT_ERROR_CODES.PRODUCT_NOT_SELLABLE,
    );
  });

  it("rejects available=false", async () => {
    await expectCode(
      pickupInput(),
      withCatalog({ products: [simpleProduct({ available: false })] }),
      CHECKOUT_ERROR_CODES.PRODUCT_NOT_SELLABLE,
    );
  });

  it("rejects TRACKED stock 0 as not sellable", async () => {
    await expectCode(
      pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 1 }] }),
      withCatalog({
        products: [
          simpleProduct({
            id: PROD_TRACKED_ID,
            stockMode: "TRACKED",
            stockQuantity: 0,
          }),
        ],
      }),
      CHECKOUT_ERROR_CODES.PRODUCT_NOT_SELLABLE,
    );
  });

  it("allows TRACKED stock when quantity is covered (precheck only)", async () => {
    const result = await prepareOrder(
      pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 2 }] }),
      baseDeps(),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects TRACKED demand above visible stock", async () => {
    await expectCode(
      pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 6 }] }),
      baseDeps(),
      CHECKOUT_ERROR_CODES.INSUFFICIENT_STOCK,
    );
  });

  it("ignores stockQuantity for NOT_TRACKED", async () => {
    const result = await prepareOrder(
      pickupInput(),
      withCatalog({
        products: [
          simpleProduct({ stockMode: "NOT_TRACKED", stockQuantity: 0 }),
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects an empty cart", async () => {
    await expectCode(
      pickupInput({ lines: [] }),
      baseDeps(),
      CHECKOUT_ERROR_CODES.EMPTY_CART,
    );
  });
});

describe("prepareOrder options", () => {
  const singleGroup: CheckoutOptionGroupRecord = {
    id: GROUP_SINGLE_ID,
    productId: PROD_SIMPLE_ID,
    name: "Tamaño",
    selectionMode: "SINGLE",
    minSelections: 1,
    maxSelections: 1,
    sortOrder: 0,
    active: true,
  };
  const singleChoices: CheckoutOptionChoiceRecord[] = [
    {
      id: CHOICE_GRANDE_ID,
      groupId: GROUP_SINGLE_ID,
      name: "Grande",
      priceDeltaCents: 20000,
      sortOrder: 0,
      active: true,
    },
    {
      id: CHOICE_CHICA_ID,
      groupId: GROUP_SINGLE_ID,
      name: "Chica",
      priceDeltaCents: 0,
      sortOrder: 1,
      active: true,
    },
    {
      id: CHOICE_INACTIVE_ID,
      groupId: GROUP_SINGLE_ID,
      name: "Vieja",
      priceDeltaCents: 0,
      sortOrder: 2,
      active: false,
    },
  ];
  const multiGroup: CheckoutOptionGroupRecord = {
    id: GROUP_MULTI_ID,
    productId: PROD_SIMPLE_ID,
    name: "Extras",
    selectionMode: "MULTIPLE",
    minSelections: 1,
    maxSelections: 2,
    sortOrder: 1,
    active: true,
  };
  const multiChoices: CheckoutOptionChoiceRecord[] = [
    {
      id: CHOICE_EXTRA_A_ID,
      groupId: GROUP_MULTI_ID,
      name: "A",
      priceDeltaCents: 1000,
      sortOrder: 0,
      active: true,
    },
    {
      id: CHOICE_EXTRA_B_ID,
      groupId: GROUP_MULTI_ID,
      name: "B",
      priceDeltaCents: 2000,
      sortOrder: 1,
      active: true,
    },
    {
      id: CHOICE_EXTRA_C_ID,
      groupId: GROUP_MULTI_ID,
      name: "C",
      priceDeltaCents: 3000,
      sortOrder: 2,
      active: true,
    },
  ];

  it("accepts a valid SINGLE selection and rejects two choices", async () => {
    const deps = withCatalog({
      products: [simpleProduct()],
      groups: [singleGroup],
      choices: singleChoices,
    });
    const valid = await prepareOrder(
      pickupInput({
        lines: [
          {
            productId: PROD_SIMPLE_ID,
            quantity: 1,
            groups: [
              {
                groupId: GROUP_SINGLE_ID,
                selections: [{ choiceId: CHOICE_GRANDE_ID, quantity: 1 }],
              },
            ],
          },
        ],
      }),
      deps,
    );
    expect(valid.ok).toBe(true);

    await expectCode(
      pickupInput({
        lines: [
          {
            productId: PROD_SIMPLE_ID,
            quantity: 1,
            groups: [
              {
                groupId: GROUP_SINGLE_ID,
                selections: [
                  { choiceId: CHOICE_GRANDE_ID, quantity: 1 },
                  { choiceId: CHOICE_CHICA_ID, quantity: 1 },
                ],
              },
            ],
          },
        ],
      }),
      deps,
      CHECKOUT_ERROR_CODES.INVALID_OPTION_SELECTION,
    );
  });

  it("enforces MULTIPLE min/max", async () => {
    const deps = withCatalog({
      products: [simpleProduct()],
      groups: [multiGroup],
      choices: multiChoices,
    });
    const valid = await prepareOrder(
      pickupInput({
        lines: [
          {
            productId: PROD_SIMPLE_ID,
            quantity: 1,
            groups: [
              {
                groupId: GROUP_MULTI_ID,
                selections: [
                  { choiceId: CHOICE_EXTRA_A_ID, quantity: 1 },
                  { choiceId: CHOICE_EXTRA_B_ID, quantity: 1 },
                ],
              },
            ],
          },
        ],
      }),
      deps,
    );
    expect(valid.ok).toBe(true);

    await expectCode(
      pickupInput({
        lines: [
          {
            productId: PROD_SIMPLE_ID,
            quantity: 1,
            groups: [
              {
                groupId: GROUP_MULTI_ID,
                selections: [
                  { choiceId: CHOICE_EXTRA_A_ID, quantity: 1 },
                  { choiceId: CHOICE_EXTRA_B_ID, quantity: 1 },
                  { choiceId: CHOICE_EXTRA_C_ID, quantity: 1 },
                ],
              },
            ],
          },
        ],
      }),
      deps,
      CHECKOUT_ERROR_CODES.INVALID_OPTION_SELECTION,
    );
  });

  it("accepts QUANTITY 12/12 with 6-3-3", async () => {
    const result = await prepareOrder(
      pickupInput({ lines: [empanadasLine()] }),
      baseDeps(),
    );
    expect(result.ok).toBe(true);
  });

  it("accepts QUANTITY 12 Carne", async () => {
    const result = await prepareOrder(
      pickupInput({
        lines: [empanadasLine([{ choiceId: CHOICE_CARNE_ID, quantity: 12 }])],
      }),
      baseDeps(),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects QUANTITY total 11", async () => {
    await expectCode(
      pickupInput({
        lines: [
          empanadasLine([
            { choiceId: CHOICE_CARNE_ID, quantity: 5 },
            { choiceId: CHOICE_JYQ_ID, quantity: 3 },
            { choiceId: CHOICE_VERDURA_ID, quantity: 3 },
          ]),
        ],
      }),
      baseDeps(),
      CHECKOUT_ERROR_CODES.INVALID_OPTION_SELECTION,
    );
  });

  it("rejects QUANTITY total 13", async () => {
    await expectCode(
      pickupInput({
        lines: [empanadasLine([{ choiceId: CHOICE_CARNE_ID, quantity: 13 }])],
      }),
      baseDeps(),
      CHECKOUT_ERROR_CODES.INVALID_OPTION_SELECTION,
    );
  });

  it("rejects a foreign option group", async () => {
    await expectCode(
      pickupInput({
        lines: [
          {
            productId: PROD_SIMPLE_ID,
            quantity: 1,
            groups: [
              {
                groupId: GROUP_FOREIGN_ID,
                selections: [{ choiceId: CHOICE_FOREIGN_ID, quantity: 1 }],
              },
            ],
          },
        ],
      }),
      baseDeps(),
      CHECKOUT_ERROR_CODES.INVALID_OPTION_SELECTION,
    );
  });

  it("rejects a foreign choice from another group", async () => {
    await expectCode(
      pickupInput({
        lines: [empanadasLine([{ choiceId: CHOICE_FOREIGN_ID, quantity: 12 }])],
      }),
      withCatalog({
        products: [empanadasProduct()],
        groups: [
          saboresGroup,
          {
            id: GROUP_FOREIGN_ID,
            productId: PROD_SIMPLE_ID,
            name: "Ajeno",
            selectionMode: "SINGLE",
            minSelections: 1,
            maxSelections: 1,
            sortOrder: 0,
            active: true,
          },
        ],
        choices: [
          ...saboresChoices,
          {
            id: CHOICE_FOREIGN_ID,
            groupId: GROUP_FOREIGN_ID,
            name: "X",
            priceDeltaCents: 0,
            sortOrder: 0,
            active: true,
          },
        ],
      }),
      CHECKOUT_ERROR_CODES.INVALID_OPTION_SELECTION,
    );
  });

  it("rejects an inactive choice", async () => {
    await expectCode(
      pickupInput({
        lines: [
          {
            productId: PROD_SIMPLE_ID,
            quantity: 1,
            groups: [
              {
                groupId: GROUP_SINGLE_ID,
                selections: [{ choiceId: CHOICE_INACTIVE_ID, quantity: 1 }],
              },
            ],
          },
        ],
      }),
      withCatalog({
        products: [simpleProduct()],
        groups: [singleGroup],
        choices: singleChoices,
      }),
      CHECKOUT_ERROR_CODES.INVALID_OPTION_SELECTION,
    );
  });
});

describe("prepareOrder authoritative pricing", () => {
  it("ignores stale browser base price, option delta, names and totals", async () => {
    const untrusted = {
      ...pickupInput({ lines: [empanadasLine()] }),
      merchantName: "Comercio falso",
      cartTotal: 1,
      deliveryFee: 1,
      lines: [
        {
          productId: PROD_EMPANADAS_ID,
          quantity: 1,
          productName: "Producto falso",
          basePrice: 1,
          unitPrice: 1,
          lineTotal: 1,
          groups: [
            {
              groupId: GROUP_SABORES_ID,
              selections: [
                {
                  choiceId: CHOICE_CARNE_ID,
                  quantity: 6,
                  name: "Falso",
                  priceDeltaCents: 1,
                },
                {
                  choiceId: CHOICE_JYQ_ID,
                  quantity: 3,
                  name: "Falso JyQ",
                  priceDeltaCents: 1,
                },
                {
                  choiceId: CHOICE_VERDURA_ID,
                  quantity: 3,
                  name: "Falsa verdura",
                  priceDeltaCents: 1,
                },
              ],
            },
          ],
        },
      ],
    } as unknown as PrepareOrderInput;

    const result = await prepareOrder(untrusted, baseDeps());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const line = result.value.lines[0];
    expect(line.productNameSnapshot).toBe("Empanadas docena");
    expect(line.unitPriceCents).toBe(250000);
    expect(result.value.merchantNameSnapshot).toBe("Empanadas Rawson");
    expect(result.value.deliveryFeeCents).toBe(0);
    // 250000 + (6*0 + 3*10000 + 3*5000) = 295000
    expect(line.lineTotalCents).toBe(295000);
    expect(result.value.totalCents).toBe(295000);
    expect(result.value.totalCents).not.toBe(1);
    expect(
      line.options.map((option) => option.optionChoiceNameSnapshot),
    ).toEqual(["Carne", "Jamón y queso", "Verdura"]);
    expect(line.options.map((option) => option.priceDeltaCents)).toEqual([
      0, 10000, 5000,
    ]);
  });

  it("keeps exact MoneyCents and multiplies line quantity", async () => {
    const result = await prepareOrder(
      pickupInput({ lines: [{ productId: PROD_SIMPLE_ID, quantity: 3 }] }),
      baseDeps(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lines[0].unitPriceCents).toBe(100000);
    expect(result.value.lines[0].lineTotalCents).toBe(300000);
    expect(result.value.itemSubtotalCents).toBe(300000);
    expect(Number.isInteger(result.value.totalCents)).toBe(true);
  });
});

describe("prepareOrder pickup", () => {
  it("rejects pickup when disabled", async () => {
    await expectCode(
      pickupInput(),
      withCatalog({ merchant: merchant({ pickupEnabled: false }) }),
      CHECKOUT_ERROR_CODES.PICKUP_UNAVAILABLE,
    );
  });

  it("rejects pickup outside the merchant home zone", async () => {
    await expectCode(
      pickupInput({ customerZoneId: ZONE_DELIVERY_ID }),
      baseDeps(),
      CHECKOUT_ERROR_CODES.PICKUP_UNAVAILABLE,
    );
  });
});

describe("prepareOrder merchant delivery", () => {
  it("requires a delivery zone", async () => {
    await expectCode(
      deliveryInput({ delivery: undefined }),
      baseDeps(),
      CHECKOUT_ERROR_CODES.DELIVERY_ZONE_REQUIRED,
    );
  });

  it("rejects an inactive zone", async () => {
    await expectCode(
      deliveryInput(),
      withCatalog({ zones: [deliveryZone({ active: false })] }),
      CHECKOUT_ERROR_CODES.DELIVERY_ZONE_NOT_SERVED,
    );
  });

  it("rejects a foreign zone", async () => {
    await expectCode(
      deliveryInput({
        delivery: {
          zoneId: ZONE_FOREIGN_ID,
          street: "San Martín",
          number: "123",
        },
      }),
      baseDeps(),
      CHECKOUT_ERROR_CODES.DELIVERY_ZONE_NOT_SERVED,
    );
  });

  it("rejects subtotal = minimum - 1 cent", async () => {
    await expectCode(
      deliveryInput(),
      withCatalog({
        products: [simpleProduct({ priceCents: 100000 })],
        zones: [deliveryZone({ minimumOrderCents: 100001 })],
      }),
      CHECKOUT_ERROR_CODES.DELIVERY_MINIMUM_NOT_MET,
    );
  });

  it("allows subtotal equal to the zone minimum", async () => {
    const result = await prepareOrder(
      deliveryInput(),
      withCatalog({
        products: [simpleProduct({ priceCents: 100000 })],
        zones: [deliveryZone({ minimumOrderCents: 100000 })],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("requires street and number", async () => {
    await expectCode(
      deliveryInput({
        delivery: { zoneId: ZONE_DELIVERY_ID, street: "  ", number: "123" },
      }),
      baseDeps(),
      CHECKOUT_ERROR_CODES.DELIVERY_ADDRESS_REQUIRED,
    );
    await expectCode(
      deliveryInput({
        delivery: {
          zoneId: ZONE_DELIVERY_ID,
          street: "San Martín",
          number: "",
        },
      }),
      baseDeps(),
      CHECKOUT_ERROR_CODES.DELIVERY_ADDRESS_REQUIRED,
    );
  });

  it("ignores a browser delivery fee", async () => {
    const untrusted = {
      ...deliveryInput(),
      deliveryFee: 1,
      delivery: {
        zoneId: ZONE_DELIVERY_ID,
        street: "San Martín",
        number: "123",
        feeCents: 1,
        estimatedMinutes: 1,
      },
    } as unknown as PrepareOrderInput;
    const result = await prepareOrder(untrusted, baseDeps());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.deliveryFeeCents).toBe(15000);
    expect(result.value.delivery?.estimatedMinutes).toBe(40);
  });
});

describe("prepareOrder payment", () => {
  it("accepts an active merchant payment method", async () => {
    const result = await prepareOrder(pickupInput(), baseDeps());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.paymentMethodSnapshot).toEqual({
      code: "CASH",
      label: "Efectivo",
      instructions: "Pagar al recibir",
    });
  });

  it("rejects an inactive payment method", async () => {
    await expectCode(
      pickupInput({ paymentMethodCode: "TRANSFER" }),
      baseDeps(),
      CHECKOUT_ERROR_CODES.PAYMENT_METHOD_INVALID,
    );
  });

  it("rejects a payment method that belongs to another merchant", async () => {
    await expectCode(
      pickupInput({ paymentMethodCode: "MERCADO_PAGO" }),
      baseDeps(),
      CHECKOUT_ERROR_CODES.PAYMENT_METHOD_INVALID,
    );
  });

  it("ignores browser payment label and instructions", async () => {
    const untrusted = {
      ...pickupInput(),
      paymentLabel: "Fake",
      paymentInstructions: "Ignore me",
    } as unknown as PrepareOrderInput;
    const result = await prepareOrder(untrusted, baseDeps());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.paymentMethodSnapshot.label).toBe("Efectivo");
    expect(result.value.paymentMethodSnapshot.instructions).toBe(
      "Pagar al recibir",
    );
  });
});

describe("prepareOrder contact and idempotency", () => {
  it("accepts a valid guest contact", async () => {
    const result = await prepareOrder(pickupInput(), baseDeps());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.customerUserId).toBeNull();
    expect(result.value.customerPhoneSnapshot).toBe("2804123456");
  });

  it("rejects an invalid name", async () => {
    await expectCode(
      pickupInput({ customer: { name: "   ", phone: "2804123456" } }),
      baseDeps(),
      CHECKOUT_ERROR_CODES.CONTACT_INVALID,
    );
  });

  it("rejects an invalid phone", async () => {
    await expectCode(
      pickupInput({ customer: { name: "Ana", phone: "123" } }),
      baseDeps(),
      CHECKOUT_ERROR_CODES.CONTACT_INVALID,
    );
  });

  it("accepts a well-shaped idempotency key", async () => {
    const result = await prepareOrder(pickupInput(), baseDeps());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.idempotencyKey).toBe(IDEMPOTENCY_KEY);
  });

  it("rejects a malformed idempotency key", async () => {
    await expectCode(
      pickupInput({ idempotencyKey: "bad key!" }),
      baseDeps(),
      CHECKOUT_ERROR_CODES.IDEMPOTENCY_KEY_INVALID,
    );
  });
});

describe("prepareOrder fulfillment mvp", () => {
  it("rejects PLATFORM_DELIVERY", async () => {
    await expectCode(
      pickupInput({ fulfillmentMethod: "PLATFORM_DELIVERY" }),
      baseDeps(),
      CHECKOUT_ERROR_CODES.INVALID_FULFILLMENT,
    );
  });
});
