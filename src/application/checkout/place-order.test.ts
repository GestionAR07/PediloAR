import { describe, expect, it, vi } from "vitest";
import { isMerchantOperationallyAcceptingOrders } from "@/domain/merchant/operational-availability";
import { moneyCents } from "@/domain/money/money-cents";
import { assertOrderDeliveryCompatibility } from "@/domain/order/fulfillment-compat";
import { CHECKOUT_ERROR_CODES, checkoutError } from "./errors";
import { placeOrder, type PlaceOrderDeps } from "./place-order";
import type {
  CheckoutDeliveryZoneRecord,
  CheckoutMerchantRecord,
  CheckoutOptionChoiceRecord,
  CheckoutOptionGroupRecord,
  CheckoutPaymentMethodRecord,
  CheckoutProductRecord,
  PersistPreparedOrderResult,
  PersistedCheckoutOrder,
  PreparedOrder,
  PrepareOrderInput,
} from "./types";

const NOW = new Date("2026-08-13T12:00:00.000Z");
const MERCHANT_ID = "11111111-1111-4111-8111-111111111111";
const CITY_ID = "33333333-3333-4333-8333-333333333333";
const ZONE_HOME_ID = "44444444-4444-4444-8444-444444444444";
const ZONE_DELIVERY_ID = "55555555-5555-4555-8555-555555555555";
const ZONE_OTHER_ID = "66666666-6666-4666-8666-666666666666";
const PROD_SIMPLE_ID = "77777777-7777-4777-8777-777777777777";
const PROD_EMPANADAS_ID = "88888888-8888-4888-8888-888888888888";
const PROD_TRACKED_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROD_TRACKED_B_ID = "abababab-abab-4bab-8bab-abababababab";
const GROUP_SABORES_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CHOICE_CARNE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CHOICE_JYQ_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const CHOICE_VERDURA_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const IDEMPOTENCY_KEY = "checkout-retry-key-01";

type StoredItem = {
  productId: string;
  productNameSnapshot: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  options: Array<{
    optionGroupId: string;
    optionChoiceId: string;
    optionGroupNameSnapshot: string;
    optionChoiceNameSnapshot: string;
    priceDeltaCents: number;
    quantity: number;
  }>;
};

type StoredOrder = {
  aggregate: PersistedCheckoutOrder;
  items: StoredItem[];
  event: {
    fromStatus: null;
    toStatus: "PENDING";
    actorType: "CUSTOMER";
    actorId: string | null;
  };
  delivery: {
    provider: "MERCHANT";
    status: "PENDING";
    feeCents: number;
    estimatedMinutes: number;
  } | null;
};

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

function trackedProduct(
  overrides: Partial<CheckoutProductRecord> = {},
): CheckoutProductRecord {
  return {
    id: PROD_TRACKED_ID,
    merchantId: MERCHANT_ID,
    name: "Stockeado",
    priceCents: 100000,
    active: true,
    available: true,
    stockMode: "TRACKED",
    stockQuantity: 5,
    sortOrder: 2,
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

function cashPayment(): CheckoutPaymentMethodRecord {
  return {
    code: "CASH",
    label: "Efectivo",
    instructions: "Pagar al recibir",
    active: true,
  };
}

function transferPayment(): CheckoutPaymentMethodRecord {
  return {
    code: "TRANSFER",
    label: "Transferencia",
    instructions: "Alias comercio",
    active: true,
  };
}

function deliveryZone(): CheckoutDeliveryZoneRecord {
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

function empanadasLine() {
  return {
    productId: PROD_EMPANADAS_ID,
    quantity: 1,
    groups: [{ groupId: GROUP_SABORES_ID, selections: dozenSelections }],
  };
}

class MemoryCheckout {
  catalogMerchant: CheckoutMerchantRecord;
  writeMerchant: CheckoutMerchantRecord;
  catalogProducts: CheckoutProductRecord[];
  writeProducts: CheckoutProductRecord[];
  groups: CheckoutOptionGroupRecord[];
  choices: CheckoutOptionChoiceRecord[];
  payments: CheckoutPaymentMethodRecord[];
  zones: CheckoutDeliveryZoneRecord[];
  orders = new Map<string, StoredOrder>();
  failNext: "item" | "option" | "delivery" | null = null;

  constructor() {
    const m = merchant();
    this.catalogMerchant = m;
    this.writeMerchant = m;
    const products = [simpleProduct(), empanadasProduct(), trackedProduct()];
    this.catalogProducts = products;
    this.writeProducts = products;
    this.groups = [saboresGroup];
    this.choices = [...saboresChoices];
    this.payments = [cashPayment(), transferPayment()];
    this.zones = [deliveryZone()];
  }

  productStock(id: string): number | null {
    return (
      this.writeProducts.find((row) => row.id === id)?.stockQuantity ?? null
    );
  }

  onlyOrder(): StoredOrder {
    expect(this.orders.size).toBe(1);
    return [...this.orders.values()][0]!;
  }

  deps(overrides: Partial<PlaceOrderDeps> = {}): PlaceOrderDeps {
    return {
      now: () => NOW,
      findMerchantById: vi.fn(async () => this.catalogMerchant),
      listProductsByIds: vi.fn(async (ids) =>
        this.catalogProducts.filter((row) => ids.includes(row.id)),
      ),
      listOptionGroupsForProducts: vi.fn(async (ids) =>
        this.groups.filter((row) => ids.includes(row.productId)),
      ),
      listOptionChoicesForGroups: vi.fn(async (ids) =>
        this.choices.filter((row) => ids.includes(row.groupId)),
      ),
      listPaymentMethodsForMerchant: vi.fn(async () => this.payments),
      listDeliveryZonesForMerchant: vi.fn(async () => this.zones),
      findOrderByIdempotencyKey: vi.fn(async (key) => this.findByKey(key)),
      persistPreparedOrder: vi.fn(async (prepared) => this.persist(prepared)),
      ...overrides,
    };
  }

  findByKey(key: string): PersistedCheckoutOrder | null {
    return this.orders.get(key)?.aggregate ?? null;
  }

  persist(prepared: PreparedOrder): PersistPreparedOrderResult {
    if (
      !isMerchantOperationallyAcceptingOrders(
        {
          status: this.writeMerchant.status as "DRAFT" | "ACTIVE" | "SUSPENDED",
          acceptingOrders: this.writeMerchant.acceptingOrders,
          pausedUntil: this.writeMerchant.pausedUntil,
        },
        NOW,
      )
    ) {
      return {
        status: "rejected",
        error: checkoutError(
          CHECKOUT_ERROR_CODES.MERCHANT_NOT_ACCEPTING,
          "El comercio no está tomando pedidos.",
        ),
      };
    }

    const nextProducts = structuredClone(this.writeProducts);
    for (const line of prepared.lines) {
      const product = nextProducts.find((row) => row.id === line.productId);
      if (
        !product ||
        product.merchantId !== prepared.merchantId ||
        !product.active ||
        !product.available
      ) {
        return {
          status: "rejected",
          error: checkoutError(
            CHECKOUT_ERROR_CODES.PRODUCT_NOT_SELLABLE,
            "Un producto no está disponible para la venta.",
          ),
        };
      }
    }

    if (this.orders.has(prepared.idempotencyKey)) {
      return { status: "unique_violation" };
    }

    const demand = new Map<string, number>();
    for (const line of prepared.lines) {
      demand.set(
        line.productId,
        (demand.get(line.productId) ?? 0) + line.quantity,
      );
    }
    for (const [productId, quantity] of demand) {
      const product = nextProducts.find((row) => row.id === productId)!;
      if (product.stockMode !== "TRACKED") {
        continue;
      }
      if ((product.stockQuantity ?? 0) < quantity) {
        return {
          status: "rejected",
          error: checkoutError(
            CHECKOUT_ERROR_CODES.INSUFFICIENT_STOCK,
            "No hay stock suficiente para uno de los productos.",
          ),
        };
      }
      product.stockQuantity = (product.stockQuantity ?? 0) - quantity;
    }

    if (this.failNext === "item") {
      this.failNext = null;
      return {
        status: "rejected",
        error: checkoutError(
          CHECKOUT_ERROR_CODES.ORDER_PERSISTENCE_FAILED,
          "No se pudo crear el ítem.",
        ),
      };
    }

    const items: StoredItem[] = prepared.lines.map((line) => ({
      productId: line.productId,
      productNameSnapshot: line.productNameSnapshot,
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      lineTotalCents: line.lineTotalCents,
      options: line.options.map((option) => ({
        optionGroupId: option.optionGroupId,
        optionChoiceId: option.optionChoiceId,
        optionGroupNameSnapshot: option.optionGroupNameSnapshot,
        optionChoiceNameSnapshot: option.optionChoiceNameSnapshot,
        priceDeltaCents: option.priceDeltaCents,
        quantity: option.quantity,
      })),
    }));

    if (this.failNext === "option") {
      this.failNext = null;
      return {
        status: "rejected",
        error: checkoutError(
          CHECKOUT_ERROR_CODES.ORDER_PERSISTENCE_FAILED,
          "No se pudo crear la opción.",
        ),
      };
    }

    let delivery: StoredOrder["delivery"] = null;
    if (prepared.fulfillmentMethod === "PICKUP") {
      const compat = assertOrderDeliveryCompatibility(
        { fulfillmentMethod: "PICKUP" },
        null,
      );
      if (!compat.ok) {
        return {
          status: "rejected",
          error: checkoutError(
            CHECKOUT_ERROR_CODES.INVALID_FULFILLMENT,
            "El pedido de retiro no puede tener envío.",
          ),
        };
      }
    } else {
      if (this.failNext === "delivery") {
        this.failNext = null;
        return {
          status: "rejected",
          error: checkoutError(
            CHECKOUT_ERROR_CODES.ORDER_PERSISTENCE_FAILED,
            "No se pudo crear el envío.",
          ),
        };
      }
      if (!prepared.delivery) {
        return {
          status: "rejected",
          error: checkoutError(
            CHECKOUT_ERROR_CODES.DELIVERY_ADDRESS_REQUIRED,
            "Completá la dirección de entrega.",
          ),
        };
      }
      const compat = assertOrderDeliveryCompatibility(
        { fulfillmentMethod: "MERCHANT_DELIVERY" },
        { provider: "MERCHANT" },
      );
      if (!compat.ok) {
        return {
          status: "rejected",
          error: checkoutError(
            CHECKOUT_ERROR_CODES.INVALID_FULFILLMENT,
            "El envío del pedido no es válido.",
          ),
        };
      }
      delivery = {
        provider: "MERCHANT",
        status: "PENDING",
        feeCents: prepared.delivery.feeCents,
        estimatedMinutes: prepared.delivery.estimatedMinutes,
      };
    }

    const orderId = crypto.randomUUID();
    const aggregate: PersistedCheckoutOrder = {
      orderId,
      status: "PENDING",
      merchantId: prepared.merchantId,
      totalCents: prepared.totalCents,
      fulfillmentMethod: prepared.fulfillmentMethod,
      customerNameSnapshot: prepared.customerNameSnapshot,
      customerPhoneSnapshot: prepared.customerPhoneSnapshot,
      paymentMethodCode: prepared.paymentMethodSnapshot.code,
      deliveryZoneId: prepared.delivery?.zoneId ?? null,
      deliveryStreet: prepared.delivery?.street ?? null,
      deliveryNumber: prepared.delivery?.number ?? null,
      deliveryFloorApartment: prepared.delivery?.floorApartment ?? null,
      deliveryReference: prepared.delivery?.reference ?? null,
      lines: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        options: item.options.map((option) => ({
          optionGroupId: option.optionGroupId,
          optionChoiceId: option.optionChoiceId,
          quantity: option.quantity,
        })),
      })),
    };

    this.writeProducts = nextProducts;
    this.orders.set(prepared.idempotencyKey, {
      aggregate,
      items,
      event: {
        fromStatus: null,
        toStatus: "PENDING",
        actorType: "CUSTOMER",
        actorId: prepared.customerUserId,
      },
      delivery,
    });

    return {
      status: "created",
      order: {
        orderId,
        status: "PENDING",
        merchantId: prepared.merchantId,
        totalCents: moneyCents(prepared.totalCents),
        fulfillmentMethod: prepared.fulfillmentMethod,
      },
    };
  }
}

describe("placeOrder pickup happy path", () => {
  it("creates Order, items, initial event, no Delivery, and decrements TRACKED stock", async () => {
    const world = new MemoryCheckout();
    const result = await placeOrder(
      pickupInput({
        lines: [{ productId: PROD_TRACKED_ID, quantity: 2 }],
      }),
      world.deps(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.replayed).toBe(false);
    expect(result.value.status).toBe("PENDING");
    const stored = world.onlyOrder();
    expect(stored.items).toHaveLength(1);
    expect(stored.items[0]?.options).toEqual([]);
    expect(stored.event).toEqual({
      fromStatus: null,
      toStatus: "PENDING",
      actorType: "CUSTOMER",
      actorId: null,
    });
    expect(stored.delivery).toBeNull();
    expect(stored.aggregate.totalCents).toBe(200000);
    expect(world.productStock(PROD_TRACKED_ID)).toBe(3);
  });
});

describe("placeOrder merchant delivery happy path", () => {
  it("creates Delivery PENDING MERCHANT with exact fee and decrements stock", async () => {
    const world = new MemoryCheckout();
    const result = await placeOrder(
      deliveryInput({
        lines: [{ productId: PROD_TRACKED_ID, quantity: 1 }],
      }),
      world.deps(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = world.onlyOrder();
    expect(stored.delivery).toEqual({
      provider: "MERCHANT",
      status: "PENDING",
      feeCents: 15000,
      estimatedMinutes: 40,
    });
    expect(stored.event.toStatus).toBe("PENDING");
    expect(world.productStock(PROD_TRACKED_ID)).toBe(4);
    expect(result.value.totalCents).toBe(115000);
  });
});

describe("placeOrder stock", () => {
  it("does not mutate NOT_TRACKED stock", async () => {
    const world = new MemoryCheckout();
    const result = await placeOrder(pickupInput(), world.deps());
    expect(result.ok).toBe(true);
    expect(world.productStock(PROD_SIMPLE_ID)).toBeNull();
    expect(world.productStock(PROD_TRACKED_ID)).toBe(5);
  });

  it("decrements aggregate line quantity for the same TRACKED product", async () => {
    const world = new MemoryCheckout();
    const result = await placeOrder(
      pickupInput({
        lines: [
          { productId: PROD_TRACKED_ID, quantity: 1 },
          { productId: PROD_TRACKED_ID, quantity: 2 },
        ],
      }),
      world.deps(),
    );
    expect(result.ok).toBe(true);
    expect(world.onlyOrder().items).toHaveLength(2);
    expect(world.productStock(PROD_TRACKED_ID)).toBe(2);
  });

  it("rolls back Order, event, Delivery and stock when persist-time stock is insufficient", async () => {
    const world = new MemoryCheckout();
    world.writeProducts = [
      trackedProduct({ stockQuantity: 1 }),
      trackedProduct({
        id: PROD_TRACKED_B_ID,
        name: "Otro",
        stockQuantity: 0,
      }),
    ];
    world.catalogProducts = [
      trackedProduct({ stockQuantity: 5 }),
      trackedProduct({
        id: PROD_TRACKED_B_ID,
        name: "Otro",
        stockQuantity: 5,
      }),
    ];
    const result = await placeOrder(
      pickupInput({
        lines: [
          { productId: PROD_TRACKED_ID, quantity: 1 },
          { productId: PROD_TRACKED_B_ID, quantity: 1 },
        ],
      }),
      world.deps(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(CHECKOUT_ERROR_CODES.INSUFFICIENT_STOCK);
    expect(world.orders.size).toBe(0);
    expect(world.productStock(PROD_TRACKED_ID)).toBe(1);
    expect(world.productStock(PROD_TRACKED_B_ID)).toBe(0);
  });
});

describe("placeOrder rollback", () => {
  it("rolls back Order and stock when item insert fails", async () => {
    const world = new MemoryCheckout();
    world.failNext = "item";
    const result = await placeOrder(
      pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 2 }] }),
      world.deps(),
    );
    expect(result.ok).toBe(false);
    expect(world.orders.size).toBe(0);
    expect(world.productStock(PROD_TRACKED_ID)).toBe(5);
  });

  it("rolls back everything when option insert fails", async () => {
    const world = new MemoryCheckout();
    world.failNext = "option";
    const result = await placeOrder(
      pickupInput({ lines: [empanadasLine()] }),
      world.deps(),
    );
    expect(result.ok).toBe(false);
    expect(world.orders.size).toBe(0);
  });

  it("rolls back everything when Delivery insert fails", async () => {
    const world = new MemoryCheckout();
    world.failNext = "delivery";
    const result = await placeOrder(
      deliveryInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 1 }] }),
      world.deps(),
    );
    expect(result.ok).toBe(false);
    expect(world.orders.size).toBe(0);
    expect(world.productStock(PROD_TRACKED_ID)).toBe(5);
  });
});

describe("placeOrder idempotency", () => {
  it("replays the same key and same request without a second Order", async () => {
    const world = new MemoryCheckout();
    const deps = world.deps();
    const first = await placeOrder(pickupInput(), deps);
    const second = await placeOrder(pickupInput(), deps);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.replayed).toBe(true);
    expect(second.value.orderId).toBe(first.value.orderId);
    expect(world.orders.size).toBe(1);
    expect(deps.listProductsByIds).toHaveBeenCalledTimes(1);
  });

  it("replays the same normalized request when line order differs", async () => {
    const world = new MemoryCheckout();
    const first = await placeOrder(
      pickupInput({
        lines: [
          { productId: PROD_SIMPLE_ID, quantity: 1 },
          { productId: PROD_TRACKED_ID, quantity: 1 },
        ],
      }),
      world.deps(),
    );
    const second = await placeOrder(
      pickupInput({
        lines: [
          { productId: PROD_TRACKED_ID, quantity: 1 },
          { productId: PROD_SIMPLE_ID, quantity: 1 },
        ],
      }),
      world.deps(),
    );
    expect(first.ok && second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.replayed).toBe(true);
    expect(world.orders.size).toBe(1);
  });

  it("conflicts when quantity changes", async () => {
    const world = new MemoryCheckout();
    await placeOrder(
      pickupInput({ lines: [{ productId: PROD_SIMPLE_ID, quantity: 1 }] }),
      world.deps(),
    );
    const second = await placeOrder(
      pickupInput({ lines: [{ productId: PROD_SIMPLE_ID, quantity: 2 }] }),
      world.deps(),
    );
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe(CHECKOUT_ERROR_CODES.IDEMPOTENCY_CONFLICT);
    expect(world.orders.size).toBe(1);
  });

  it("conflicts when an option selection changes", async () => {
    const world = new MemoryCheckout();
    await placeOrder(pickupInput({ lines: [empanadasLine()] }), world.deps());
    const second = await placeOrder(
      pickupInput({
        lines: [
          {
            productId: PROD_EMPANADAS_ID,
            quantity: 1,
            groups: [
              {
                groupId: GROUP_SABORES_ID,
                selections: [{ choiceId: CHOICE_CARNE_ID, quantity: 12 }],
              },
            ],
          },
        ],
      }),
      world.deps(),
    );
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe(CHECKOUT_ERROR_CODES.IDEMPOTENCY_CONFLICT);
  });

  it("conflicts when payment changes", async () => {
    const world = new MemoryCheckout();
    await placeOrder(pickupInput(), world.deps());
    const second = await placeOrder(
      pickupInput({ paymentMethodCode: "TRANSFER" }),
      world.deps(),
    );
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe(CHECKOUT_ERROR_CODES.IDEMPOTENCY_CONFLICT);
  });

  it("conflicts when delivery address changes", async () => {
    const world = new MemoryCheckout();
    await placeOrder(deliveryInput(), world.deps());
    const second = await placeOrder(
      deliveryInput({
        delivery: {
          zoneId: ZONE_DELIVERY_ID,
          street: "Mitre",
          number: "50",
        },
      }),
      world.deps(),
    );
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe(CHECKOUT_ERROR_CODES.IDEMPOTENCY_CONFLICT);
  });

  it("replays pickup when only customerZoneId differs", async () => {
    const world = new MemoryCheckout();
    const first = await placeOrder(
      pickupInput({ customerZoneId: ZONE_HOME_ID }),
      world.deps(),
    );
    const second = await placeOrder(
      pickupInput({ customerZoneId: ZONE_OTHER_ID }),
      world.deps(),
    );
    expect(first.ok && second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.replayed).toBe(true);
    expect(world.orders.size).toBe(1);
  });

  it("treats a unique race with the same intent as replay", async () => {
    const world = new MemoryCheckout();
    const first = await placeOrder(pickupInput(), world.deps());
    expect(first.ok).toBe(true);
    const deps = world.deps({
      findOrderByIdempotencyKey: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockImplementation(async (key: string) => world.findByKey(key)),
    });
    const loser = await placeOrder(pickupInput(), deps);
    expect(loser.ok).toBe(true);
    if (!loser.ok || !first.ok) return;
    expect(loser.value.replayed).toBe(true);
    expect(loser.value.orderId).toBe(first.value.orderId);
    expect(world.orders.size).toBe(1);
  });

  it("treats a unique race with a different intent as conflict", async () => {
    const world = new MemoryCheckout();
    await placeOrder(pickupInput(), world.deps());
    const deps = world.deps({
      findOrderByIdempotencyKey: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockImplementation(async (key: string) => world.findByKey(key)),
    });
    const loser = await placeOrder(
      pickupInput({ paymentMethodCode: "TRANSFER" }),
      deps,
    );
    expect(loser.ok).toBe(false);
    if (loser.ok) return;
    expect(loser.error.code).toBe(CHECKOUT_ERROR_CODES.IDEMPOTENCY_CONFLICT);
    expect(world.orders.size).toBe(1);
  });
});

describe("placeOrder retry after stock decrement", () => {
  it("returns the existing Order when stock is already 0", async () => {
    const world = new MemoryCheckout();
    world.catalogProducts = [trackedProduct({ stockQuantity: 1 })];
    world.writeProducts = world.catalogProducts;
    const deps = world.deps();
    const first = await placeOrder(
      pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 1 }] }),
      deps,
    );
    expect(first.ok).toBe(true);
    expect(world.productStock(PROD_TRACKED_ID)).toBe(0);

    const second = await placeOrder(
      pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 1 }] }),
      deps,
    );
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.replayed).toBe(true);
    expect(second.value.orderId).toBe(first.value.orderId);
    expect(world.orders.size).toBe(1);
    expect(world.productStock(PROD_TRACKED_ID)).toBe(0);
    expect(deps.listProductsByIds).toHaveBeenCalledTimes(1);
  });
});

describe("placeOrder money", () => {
  it("persists authoritative empanada totals and ignores browser spoof prices", async () => {
    const world = new MemoryCheckout();
    const untrusted = {
      ...pickupInput({ lines: [empanadasLine()] }),
      cartTotal: 1,
      lines: [
        {
          ...empanadasLine(),
          basePrice: 1,
          unitPrice: 1,
          lineTotal: 1,
          productName: "Fake",
        },
      ],
    } as unknown as PrepareOrderInput;

    const result = await placeOrder(untrusted, world.deps());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const item = world.onlyOrder().items[0]!;
    expect(item.productNameSnapshot).toBe("Empanadas docena");
    expect(item.unitPriceCents).toBe(250000);
    expect(item.lineTotalCents).toBe(295000);
    expect(item.options.map((option) => option.priceDeltaCents)).toEqual([
      0, 10000, 5000,
    ]);
    expect(result.value.totalCents).toBe(295000);
    expect(Number.isInteger(result.value.totalCents)).toBe(true);
  });

  it("persists the exact delivery fee in cents", async () => {
    const world = new MemoryCheckout();
    const result = await placeOrder(deliveryInput(), world.deps());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(world.onlyOrder().delivery?.feeCents).toBe(15000);
    expect(result.value.totalCents).toBe(115000);
  });
});

describe("placeOrder merchant/product write races", () => {
  it("rejects when the merchant pauses after prepare", async () => {
    const world = new MemoryCheckout();
    world.writeMerchant = merchant({
      pausedUntil: new Date("2026-08-13T13:00:00.000Z"),
    });
    const result = await placeOrder(pickupInput(), world.deps());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(CHECKOUT_ERROR_CODES.MERCHANT_NOT_ACCEPTING);
    expect(world.orders.size).toBe(0);
  });

  it("rejects when a product becomes unavailable after prepare", async () => {
    const world = new MemoryCheckout();
    world.writeProducts = [simpleProduct({ available: false })];
    const result = await placeOrder(pickupInput(), world.deps());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(CHECKOUT_ERROR_CODES.PRODUCT_NOT_SELLABLE);
    expect(world.orders.size).toBe(0);
  });
});
