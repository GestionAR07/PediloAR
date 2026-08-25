import { describe, expect, it, vi } from "vitest";
import {
  deleteProduct as deleteProductUseCase,
  updateProduct as updateProductUseCase,
  type ProductDeps,
} from "@/application/catalog/products";
import {
  DELETE_BLOCKED_BY_OPEN_ORDERS_MESSAGE,
  PRODUCT_HAS_OPEN_ORDERS,
  STOCK_MODE_BLOCKED_BY_OPEN_ORDERS_MESSAGE,
} from "@/domain/catalog/open-order-integrity";
import {
  isDeliveryTerminalStatus,
  transitionDeliveryStatus,
} from "@/domain/delivery/transitions";
import type { DeliveryStatus } from "@/domain/delivery/enums";
import { isMerchantOperationallyAcceptingOrders } from "@/domain/merchant/operational-availability";
import { moneyCents } from "@/domain/money/money-cents";
import { canCancelOrder } from "@/domain/order/cancellation";
import type { OrderStatus } from "@/domain/order/enums";
import { assertOrderDeliveryCompatibility } from "@/domain/order/fulfillment-compat";
import {
  isOrderNonTerminalStatus,
  transitionOrderStatus,
} from "@/domain/order/transitions";
import { DomainError } from "@/domain/shared/errors";
import { CHECKOUT_ERROR_CODES, checkoutError } from "./errors";
import { cancelOrder } from "./cancel-order";
import { placeOrder, type PlaceOrderDeps } from "./place-order";
import { prepareOrder } from "./prepare-order";
import { buildQuoteFingerprint } from "./checkout-review";
import type {
  CancelOrderCommand,
  CancelOrderPersistResult,
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
const CUSTOMER_USER_ID = "12121212-1212-4212-8212-121212121212";

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

type StoredEvent = {
  fromStatus: string | null;
  toStatus: string;
  actorType: string;
  actorId: string | null;
  reason: string | null;
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
  events: StoredEvent[];
  delivery: {
    provider: "MERCHANT";
    status: string;
    feeCents: number;
    estimatedMinutes: number;
  } | null;
  canceledBy?: string;
  cancelReason?: string;
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
  failNext:
    | "item"
    | "option"
    | "delivery"
    | "restock"
    | "cancel-event"
    | "cancel-delivery"
    | null = null;
  private work: Promise<void> = Promise.resolve();

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
      persistPreparedOrder: vi.fn(async (prepared) =>
        this.enqueue(() => this.persist(prepared)),
      ),
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
      customerUserId: prepared.customerUserId,
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
    const createEvent = {
      fromStatus: null,
      toStatus: "PENDING" as const,
      actorType: "CUSTOMER" as const,
      actorId: prepared.customerUserId,
    };
    this.orders.set(prepared.idempotencyKey, {
      aggregate,
      items,
      event: createEvent,
      events: [{ ...createEvent, reason: null }],
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

  findByOrderId(orderId: string): StoredOrder | null {
    return (
      [...this.orders.values()].find(
        (row) => row.aggregate.orderId === orderId,
      ) ?? null
    );
  }

  setOrderStatus(orderId: string, status: string): void {
    const stored = this.findByOrderId(orderId);
    if (stored) {
      stored.aggregate.status = status;
    }
  }

  setDeliveryStatus(orderId: string, status: string): void {
    const stored = this.findByOrderId(orderId);
    if (stored?.delivery) {
      stored.delivery.status = status;
    }
  }

  nullifyProductIds(orderId: string): void {
    const stored = this.findByOrderId(orderId);
    if (!stored) return;
    stored.items = stored.items.map((item) => ({ ...item, productId: "" }));
    stored.aggregate.lines = stored.aggregate.lines.map((line) => ({
      ...line,
      productId: null,
    }));
  }

  enqueue<T>(fn: () => T | Promise<T>): Promise<T> {
    const run = this.work.then(async () => fn());
    this.work = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  hasOpenNonTerminalOrders(merchantId: string, productId: string): boolean {
    return [...this.orders.values()].some(
      (stored) =>
        stored.aggregate.merchantId === merchantId &&
        isOrderNonTerminalStatus(stored.aggregate.status as OrderStatus) &&
        stored.items.some((item) => item.productId === productId),
    );
  }

  catalogDeps(): ProductDeps {
    return {
      requireCatalogAccess: vi.fn(async () => undefined),
      findMerchantCategoryById: vi.fn(async () => null),
      findProductById: vi.fn(async (merchantId, productId) => {
        const product = this.writeProducts.find(
          (row) => row.id === productId && row.merchantId === merchantId,
        );
        if (!product) {
          return null;
        }
        return {
          id: product.id,
          merchantCategoryId: "22222222-2222-4222-8222-222222222222",
          name: product.name,
          description: "",
          priceCents: product.priceCents,
          active: product.active,
          available: product.available,
          stockMode: product.stockMode,
          stockQuantity: product.stockQuantity,
          sortOrder: product.sortOrder,
          imagePath: null,
        };
      }),
      nextProductSortOrder: vi.fn(async () => 0),
      insertProduct: vi.fn(async () => ({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      })),
      updateProduct: vi.fn(async (merchantId, productId, patch) =>
        this.enqueue(() =>
          this.applyProductPatch(merchantId, productId, patch),
        ),
      ),
      setProductAvailability: vi.fn(async () => null),
      productHasOpenNonTerminalOrders: vi.fn(async (merchantId, productId) =>
        this.hasOpenNonTerminalOrders(merchantId, productId),
      ),
      deleteProduct: vi.fn(async (merchantId, productId) =>
        this.enqueue(() => this.deleteProductRow(merchantId, productId)),
      ),
    };
  }

  applyProductPatch(
    merchantId: string,
    productId: string,
    patch: Record<string, unknown>,
  ): { id: string } | null {
    const live = this.writeProducts.find(
      (row) => row.id === productId && row.merchantId === merchantId,
    );
    if (!live) {
      return null;
    }
    if (
      patch.stockMode !== undefined &&
      patch.stockMode !== live.stockMode &&
      this.hasOpenNonTerminalOrders(merchantId, productId)
    ) {
      throw new DomainError(
        PRODUCT_HAS_OPEN_ORDERS,
        STOCK_MODE_BLOCKED_BY_OPEN_ORDERS_MESSAGE,
      );
    }
    if (typeof patch.stockMode === "string") {
      live.stockMode = patch.stockMode;
    }
    if ("stockQuantity" in patch) {
      live.stockQuantity = patch.stockQuantity as number | null;
    }
    if (typeof patch.active === "boolean") {
      live.active = patch.active;
    }
    if (typeof patch.available === "boolean") {
      live.available = patch.available;
    }
    const catalog = this.catalogProducts.find((row) => row.id === productId);
    if (catalog) {
      catalog.stockMode = live.stockMode;
      catalog.stockQuantity = live.stockQuantity;
      catalog.active = live.active;
      catalog.available = live.available;
    }
    return { id: live.id };
  }

  deleteProductRow(
    merchantId: string,
    productId: string,
  ): { id: string } | null {
    const live = this.writeProducts.find(
      (row) => row.id === productId && row.merchantId === merchantId,
    );
    if (!live) {
      return null;
    }
    if (this.hasOpenNonTerminalOrders(merchantId, productId)) {
      throw new DomainError(
        PRODUCT_HAS_OPEN_ORDERS,
        DELETE_BLOCKED_BY_OPEN_ORDERS_MESSAGE,
      );
    }
    this.writeProducts = this.writeProducts.filter(
      (row) => row.id !== productId,
    );
    this.catalogProducts = this.catalogProducts.filter(
      (row) => row.id !== productId,
    );
    return { id: productId };
  }

  cancelDeps() {
    return {
      now: () => NOW,
      cancelOrderInTransaction: async (command: CancelOrderCommand) =>
        this.cancel(command),
    };
  }

  cancel(command: CancelOrderCommand): CancelOrderPersistResult {
    const entry = [...this.orders.entries()].find(
      ([, row]) => row.aggregate.orderId === command.orderId,
    );
    if (!entry) {
      return {
        status: "rejected",
        error: checkoutError(
          CHECKOUT_ERROR_CODES.ORDER_NOT_FOUND,
          "El pedido no existe.",
        ),
      };
    }
    const [key, stored] = entry;
    if (
      command.expectedMerchantId &&
      stored.aggregate.merchantId !== command.expectedMerchantId
    ) {
      return {
        status: "rejected",
        error: checkoutError(
          CHECKOUT_ERROR_CODES.ORDER_NOT_FOUND,
          "El pedido no existe.",
        ),
      };
    }
    if (stored.aggregate.status === "CANCELED") {
      return { status: "already_canceled", orderId: stored.aggregate.orderId };
    }
    if (
      command.expectedCurrentStatus &&
      stored.aggregate.status !== command.expectedCurrentStatus
    ) {
      return {
        status: "rejected",
        error: checkoutError(
          CHECKOUT_ERROR_CODES.ORDER_NOT_CANCELABLE,
          "El pedido ya no se puede rechazar.",
        ),
      };
    }

    if (stored.delivery?.status === "DELIVERED") {
      return {
        status: "rejected",
        error: checkoutError(
          CHECKOUT_ERROR_CODES.DELIVERY_STATE_CONFLICT,
          "No se puede cancelar un pedido cuya entrega ya fue completada.",
        ),
      };
    }

    const policy = canCancelOrder({
      actor: command.actorType,
      orderStatus: stored.aggregate.status as OrderStatus,
      delivery: stored.delivery
        ? { status: stored.delivery.status as DeliveryStatus }
        : null,
      cancelReason: command.reason,
    });
    if (!policy.ok) {
      const code = policy.error.code;
      if (code === "ORDER_CANCEL_DELIVERY_IN_TRANSIT") {
        return {
          status: "rejected",
          error: checkoutError(
            CHECKOUT_ERROR_CODES.DELIVERY_STATE_CONFLICT,
            "No se puede cancelar el pedido mientras el envío está en curso.",
          ),
        };
      }
      return {
        status: "rejected",
        error: checkoutError(
          CHECKOUT_ERROR_CODES.ORDER_NOT_CANCELABLE,
          "No se puede cancelar el pedido.",
        ),
      };
    }

    const transition = transitionOrderStatus(
      stored.aggregate.status as OrderStatus,
      "CANCELED",
    );
    if (!transition.ok) {
      return {
        status: "rejected",
        error: checkoutError(
          CHECKOUT_ERROR_CODES.ORDER_NOT_CANCELABLE,
          "No se puede cancelar el pedido.",
        ),
      };
    }

    const nextProducts = structuredClone(this.writeProducts);
    const demand = new Map<string, number>();
    for (const item of stored.items) {
      if (!item.productId) {
        continue;
      }
      demand.set(
        item.productId,
        (demand.get(item.productId) ?? 0) + item.quantity,
      );
    }

    let restoredTrackedQuantity = 0;
    for (const [productId, quantity] of demand) {
      const live = nextProducts.find((row) => row.id === productId);
      if (!live || live.stockMode !== "TRACKED" || live.stockQuantity == null) {
        continue;
      }
      live.stockQuantity += quantity;
      restoredTrackedQuantity += quantity;
    }

    if (this.failNext === "restock") {
      this.failNext = null;
      return {
        status: "rejected",
        error: checkoutError(
          CHECKOUT_ERROR_CODES.ORDER_PERSISTENCE_FAILED,
          "No se pudo restaurar el stock.",
        ),
      };
    }

    if (this.failNext === "cancel-event") {
      this.failNext = null;
      return {
        status: "rejected",
        error: checkoutError(
          CHECKOUT_ERROR_CODES.ORDER_PERSISTENCE_FAILED,
          "No se pudo registrar el evento.",
        ),
      };
    }

    let deliveryCanceled = false;
    const nextDelivery = stored.delivery ? { ...stored.delivery } : null;
    if (nextDelivery && nextDelivery.status !== "DELIVERED") {
      if (!isDeliveryTerminalStatus(nextDelivery.status as DeliveryStatus)) {
        if (this.failNext === "cancel-delivery") {
          this.failNext = null;
          return {
            status: "rejected",
            error: checkoutError(
              CHECKOUT_ERROR_CODES.DELIVERY_STATE_CONFLICT,
              "No se pudo cancelar el envío.",
            ),
          };
        }
        const moved = transitionDeliveryStatus(
          nextDelivery.provider,
          nextDelivery.status as DeliveryStatus,
          "CANCELED",
        );
        if (!moved.ok) {
          return {
            status: "rejected",
            error: checkoutError(
              CHECKOUT_ERROR_CODES.DELIVERY_STATE_CONFLICT,
              "No se puede cancelar el envío asociado.",
            ),
          };
        }
        nextDelivery.status = "CANCELED";
        deliveryCanceled = true;
      }
    }

    const previousStatus = stored.aggregate.status;
    const nextStored: StoredOrder = {
      ...stored,
      aggregate: { ...stored.aggregate, status: "CANCELED" },
      delivery: nextDelivery,
      canceledBy: command.actorType,
      cancelReason: command.reason,
      events: [
        ...stored.events,
        {
          fromStatus: previousStatus,
          toStatus: "CANCELED",
          actorType: command.actorType,
          actorId: command.actorId,
          reason: command.reason,
        },
      ],
    };

    this.writeProducts = nextProducts;
    this.orders.set(key, nextStored);

    return {
      status: "canceled",
      result: {
        orderId: stored.aggregate.orderId,
        previousStatus,
        status: "CANCELED",
        restoredTrackedQuantity,
        deliveryCanceled,
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

  it("associates the verified customer without trusting the checkout payload", async () => {
    const world = new MemoryCheckout();
    const result = await placeOrder(pickupInput(), world.deps(), {
      customerUserId: CUSTOMER_USER_ID,
    });
    expect(result.ok).toBe(true);
    const stored = world.onlyOrder();
    expect(stored.aggregate.customerUserId).toBe(CUSTOMER_USER_ID);
    expect(stored.event.actorId).toBe(CUSTOMER_USER_ID);
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

  it("never replays an order created by another customer account", async () => {
    const world = new MemoryCheckout();
    const deps = world.deps();
    await placeOrder(pickupInput(), deps, {
      customerUserId: CUSTOMER_USER_ID,
    });
    const second = await placeOrder(pickupInput(), deps, {
      customerUserId: "13131313-1313-4313-8313-131313131313",
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe(CHECKOUT_ERROR_CODES.IDEMPOTENCY_CONFLICT);
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

const customerCancel = {
  actor: { type: "CUSTOMER" as const, id: null },
  reason: "CUSTOMER_REQUEST",
};

const merchantCancel = {
  actor: { type: "MERCHANT_USER" as const, id: "merchant-user-1" },
  reason: "OUT_OF_STOCK",
};

describe("cancelOrder restock", () => {
  it("restores TRACKED stock for a PENDING order", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(
      pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 2 }] }),
      world.deps(),
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(world.productStock(PROD_TRACKED_ID)).toBe(3);

    const canceled = await cancelOrder(
      { orderId: placed.value.orderId, ...customerCancel },
      world.cancelDeps(),
    );
    expect(canceled.ok).toBe(true);
    if (!canceled.ok) return;
    expect(canceled.value.status).toBe("CANCELED");
    expect(canceled.value.previousStatus).toBe("PENDING");
    expect(canceled.value.restoredTrackedQuantity).toBe(2);
    expect(canceled.value.deliveryCanceled).toBe(false);
    expect(world.productStock(PROD_TRACKED_ID)).toBe(5);
    expect(world.onlyOrder().aggregate.status).toBe("CANCELED");
  });

  it("restores TRACKED stock for an ACCEPTED order", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(
      pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 2 }] }),
      world.deps(),
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    world.setOrderStatus(placed.value.orderId, "ACCEPTED");

    const canceled = await cancelOrder(
      { orderId: placed.value.orderId, ...merchantCancel },
      world.cancelDeps(),
    );
    expect(canceled.ok).toBe(true);
    if (!canceled.ok) return;
    expect(canceled.value.previousStatus).toBe("ACCEPTED");
    expect(world.productStock(PROD_TRACKED_ID)).toBe(5);
  });

  it("restores every TRACKED item", async () => {
    const world = new MemoryCheckout();
    world.catalogProducts = [
      trackedProduct({ stockQuantity: 5 }),
      trackedProduct({
        id: PROD_TRACKED_B_ID,
        name: "Otro",
        stockQuantity: 4,
      }),
    ];
    world.writeProducts = world.catalogProducts;
    const placed = await placeOrder(
      pickupInput({
        lines: [
          { productId: PROD_TRACKED_ID, quantity: 2 },
          { productId: PROD_TRACKED_B_ID, quantity: 1 },
        ],
      }),
      world.deps(),
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const canceled = await cancelOrder(
      { orderId: placed.value.orderId, ...customerCancel },
      world.cancelDeps(),
    );
    expect(canceled.ok).toBe(true);
    expect(world.productStock(PROD_TRACKED_ID)).toBe(5);
    expect(world.productStock(PROD_TRACKED_B_ID)).toBe(4);
  });

  it("restores aggregate quantity for the same product on multiple lines", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(
      pickupInput({
        lines: [
          { productId: PROD_TRACKED_ID, quantity: 1 },
          { productId: PROD_TRACKED_ID, quantity: 2 },
        ],
      }),
      world.deps(),
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(world.productStock(PROD_TRACKED_ID)).toBe(2);
    const canceled = await cancelOrder(
      { orderId: placed.value.orderId, ...customerCancel },
      world.cancelDeps(),
    );
    expect(canceled.ok).toBe(true);
    if (!canceled.ok) return;
    expect(canceled.value.restoredTrackedQuantity).toBe(3);
    expect(world.productStock(PROD_TRACKED_ID)).toBe(5);
  });

  it("does not restore when the live product is no longer TRACKED", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(
      pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 2 }] }),
      world.deps(),
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const live = world.writeProducts.find((row) => row.id === PROD_TRACKED_ID)!;
    live.stockMode = "NOT_TRACKED";
    const canceled = await cancelOrder(
      { orderId: placed.value.orderId, ...customerCancel },
      world.cancelDeps(),
    );
    expect(canceled.ok).toBe(true);
    if (!canceled.ok) return;
    expect(canceled.value.restoredTrackedQuantity).toBe(0);
    expect(world.productStock(PROD_TRACKED_ID)).toBe(3);
  });

  it("does not modify NOT_TRACKED stock", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(pickupInput(), world.deps());
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    await cancelOrder(
      { orderId: placed.value.orderId, ...customerCancel },
      world.cancelDeps(),
    );
    expect(world.productStock(PROD_SIMPLE_ID)).toBeNull();
    expect(world.productStock(PROD_TRACKED_ID)).toBe(5);
  });

  it("restores stock for inactive TRACKED products", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(
      pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 2 }] }),
      world.deps(),
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const live = world.writeProducts.find((row) => row.id === PROD_TRACKED_ID)!;
    live.active = false;
    const canceled = await cancelOrder(
      { orderId: placed.value.orderId, ...customerCancel },
      world.cancelDeps(),
    );
    expect(canceled.ok).toBe(true);
    expect(world.productStock(PROD_TRACKED_ID)).toBe(5);
  });

  it("restores stock for unavailable TRACKED products", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(
      pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 2 }] }),
      world.deps(),
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const live = world.writeProducts.find((row) => row.id === PROD_TRACKED_ID)!;
    live.available = false;
    await cancelOrder(
      { orderId: placed.value.orderId, ...customerCancel },
      world.cancelDeps(),
    );
    expect(world.productStock(PROD_TRACKED_ID)).toBe(5);
  });

  it("cancels when product_id is null and skips restock", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(
      pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 2 }] }),
      world.deps(),
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(world.productStock(PROD_TRACKED_ID)).toBe(3);
    world.nullifyProductIds(placed.value.orderId);

    const canceled = await cancelOrder(
      { orderId: placed.value.orderId, ...customerCancel },
      world.cancelDeps(),
    );
    expect(canceled.ok).toBe(true);
    if (!canceled.ok) return;
    expect(canceled.value.restoredTrackedQuantity).toBe(0);
    expect(world.onlyOrder().aggregate.status).toBe("CANCELED");
    expect(world.productStock(PROD_TRACKED_ID)).toBe(3);
  });

  it("restores line quantity, not QUANTITY option units", async () => {
    const world = new MemoryCheckout();
    world.catalogProducts = [
      empanadasProduct({ stockMode: "TRACKED", stockQuantity: 10 }),
    ];
    world.writeProducts = world.catalogProducts;
    const placed = await placeOrder(
      pickupInput({
        lines: [
          {
            productId: PROD_EMPANADAS_ID,
            quantity: 3,
            groups: [
              { groupId: GROUP_SABORES_ID, selections: dozenSelections },
            ],
          },
        ],
      }),
      world.deps(),
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(world.productStock(PROD_EMPANADAS_ID)).toBe(7);
    const canceled = await cancelOrder(
      { orderId: placed.value.orderId, ...customerCancel },
      world.cancelDeps(),
    );
    expect(canceled.ok).toBe(true);
    if (!canceled.ok) return;
    expect(canceled.value.restoredTrackedQuantity).toBe(3);
    expect(world.productStock(PROD_EMPANADAS_ID)).toBe(10);
  });
});

describe("cancelOrder rollback", () => {
  it("rolls back status when restock fails", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(
      pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 2 }] }),
      world.deps(),
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    world.failNext = "restock";
    const canceled = await cancelOrder(
      { orderId: placed.value.orderId, ...customerCancel },
      world.cancelDeps(),
    );
    expect(canceled.ok).toBe(false);
    expect(world.onlyOrder().aggregate.status).toBe("PENDING");
    expect(world.onlyOrder().events).toHaveLength(1);
    expect(world.productStock(PROD_TRACKED_ID)).toBe(3);
  });

  it("rolls back status and restock when event insert fails", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(
      pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 2 }] }),
      world.deps(),
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    world.failNext = "cancel-event";
    const canceled = await cancelOrder(
      { orderId: placed.value.orderId, ...customerCancel },
      world.cancelDeps(),
    );
    expect(canceled.ok).toBe(false);
    expect(world.onlyOrder().aggregate.status).toBe("PENDING");
    expect(world.productStock(PROD_TRACKED_ID)).toBe(3);
    expect(world.onlyOrder().events).toHaveLength(1);
  });

  it("rolls back everything when Delivery cancel fails", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(
      deliveryInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 1 }] }),
      world.deps(),
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    world.failNext = "cancel-delivery";
    const canceled = await cancelOrder(
      { orderId: placed.value.orderId, ...customerCancel },
      world.cancelDeps(),
    );
    expect(canceled.ok).toBe(false);
    expect(world.onlyOrder().aggregate.status).toBe("PENDING");
    expect(world.onlyOrder().delivery?.status).toBe("PENDING");
    expect(world.productStock(PROD_TRACKED_ID)).toBe(4);
  });
});

describe("cancelOrder exactly once", () => {
  it("restores stock once and rejects a second cancel", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(
      pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 2 }] }),
      world.deps(),
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const first = await cancelOrder(
      { orderId: placed.value.orderId, ...customerCancel },
      world.cancelDeps(),
    );
    const second = await cancelOrder(
      { orderId: placed.value.orderId, ...customerCancel },
      world.cancelDeps(),
    );
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe(CHECKOUT_ERROR_CODES.ORDER_ALREADY_CANCELED);
    expect(world.productStock(PROD_TRACKED_ID)).toBe(5);
    expect(
      world.onlyOrder().events.filter((event) => event.toStatus === "CANCELED"),
    ).toHaveLength(1);
  });

  it("serializes a concurrent second cancel as already canceled", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(
      pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 2 }] }),
      world.deps(),
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const [a, b] = await Promise.all([
      cancelOrder(
        { orderId: placed.value.orderId, ...customerCancel },
        world.cancelDeps(),
      ),
      cancelOrder(
        { orderId: placed.value.orderId, ...customerCancel },
        world.cancelDeps(),
      ),
    ]);
    const outcomes = [a, b];
    expect(outcomes.filter((row) => row.ok)).toHaveLength(1);
    expect(
      outcomes.filter(
        (row) =>
          !row.ok &&
          row.error.code === CHECKOUT_ERROR_CODES.ORDER_ALREADY_CANCELED,
      ),
    ).toHaveLength(1);
    expect(world.productStock(PROD_TRACKED_ID)).toBe(5);
    expect(
      world.onlyOrder().events.filter((event) => event.toStatus === "CANCELED"),
    ).toHaveLength(1);
  });
});

describe("cancelOrder merchant scope guards", () => {
  it("does not cancel or restock when expectedMerchantId does not match", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(
      pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 2 }] }),
      world.deps(),
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const canceled = await cancelOrder(
      {
        orderId: placed.value.orderId,
        ...merchantCancel,
        expectedMerchantId: "22222222-2222-4222-8222-222222222222",
      },
      world.cancelDeps(),
    );
    expect(canceled.ok).toBe(false);
    if (!canceled.ok) {
      expect(canceled.error.code).toBe(CHECKOUT_ERROR_CODES.ORDER_NOT_FOUND);
      expect(canceled.error.message).toBe("El pedido no existe.");
    }
    expect(world.onlyOrder().aggregate.status).toBe("PENDING");
    expect(world.productStock(PROD_TRACKED_ID)).toBe(3);
    expect(
      world.onlyOrder().events.filter((event) => event.toStatus === "CANCELED"),
    ).toHaveLength(0);
  });

  it("does not cancel when expectedCurrentStatus does not match the locked row", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(
      pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 2 }] }),
      world.deps(),
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    world.onlyOrder().aggregate.status = "ACCEPTED";
    const canceled = await cancelOrder(
      {
        orderId: placed.value.orderId,
        ...merchantCancel,
        expectedMerchantId: MERCHANT_ID,
        expectedCurrentStatus: "PENDING",
      },
      world.cancelDeps(),
    );
    expect(canceled.ok).toBe(false);
    if (!canceled.ok) {
      expect(canceled.error.code).toBe(
        CHECKOUT_ERROR_CODES.ORDER_NOT_CANCELABLE,
      );
    }
    expect(world.onlyOrder().aggregate.status).toBe("ACCEPTED");
    expect(world.productStock(PROD_TRACKED_ID)).toBe(3);
  });
});

describe("cancelOrder delivery", () => {
  it("does not touch Delivery on pickup", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(pickupInput(), world.deps());
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const canceled = await cancelOrder(
      { orderId: placed.value.orderId, ...customerCancel },
      world.cancelDeps(),
    );
    expect(canceled.ok).toBe(true);
    if (!canceled.ok) return;
    expect(canceled.value.deliveryCanceled).toBe(false);
    expect(world.onlyOrder().delivery).toBeNull();
  });

  it("cancels a PENDING merchant Delivery", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(deliveryInput(), world.deps());
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const canceled = await cancelOrder(
      { orderId: placed.value.orderId, ...customerCancel },
      world.cancelDeps(),
    );
    expect(canceled.ok).toBe(true);
    if (!canceled.ok) return;
    expect(canceled.value.deliveryCanceled).toBe(true);
    expect(world.onlyOrder().delivery?.status).toBe("CANCELED");
  });

  it("rejects cancel while merchant Delivery is IN_TRANSIT", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(deliveryInput(), world.deps());
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    world.setOrderStatus(placed.value.orderId, "READY");
    world.setDeliveryStatus(placed.value.orderId, "IN_TRANSIT");
    const canceled = await cancelOrder(
      { orderId: placed.value.orderId, ...merchantCancel },
      world.cancelDeps(),
    );
    expect(canceled.ok).toBe(false);
    if (canceled.ok) return;
    expect(canceled.error.code).toBe(
      CHECKOUT_ERROR_CODES.DELIVERY_STATE_CONFLICT,
    );
    expect(world.onlyOrder().aggregate.status).toBe("READY");
    expect(world.onlyOrder().delivery?.status).toBe("IN_TRANSIT");
  });

  it("rejects cancel when Delivery is already DELIVERED", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(deliveryInput(), world.deps());
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    world.setOrderStatus(placed.value.orderId, "READY");
    world.setDeliveryStatus(placed.value.orderId, "DELIVERED");
    const canceled = await cancelOrder(
      { orderId: placed.value.orderId, ...merchantCancel },
      world.cancelDeps(),
    );
    expect(canceled.ok).toBe(false);
    if (canceled.ok) return;
    expect(canceled.error.code).toBe(
      CHECKOUT_ERROR_CODES.DELIVERY_STATE_CONFLICT,
    );
    expect(world.onlyOrder().delivery?.status).toBe("DELIVERED");
  });
});

describe("cancelOrder completed and validation", () => {
  it("does not cancel or restock a COMPLETED order", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(
      pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 2 }] }),
      world.deps(),
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    world.setOrderStatus(placed.value.orderId, "COMPLETED");
    const canceled = await cancelOrder(
      { orderId: placed.value.orderId, ...merchantCancel },
      world.cancelDeps(),
    );
    expect(canceled.ok).toBe(false);
    if (canceled.ok) return;
    expect(canceled.error.code).toBe(CHECKOUT_ERROR_CODES.ORDER_NOT_CANCELABLE);
    expect(world.productStock(PROD_TRACKED_ID)).toBe(3);
    expect(world.onlyOrder().aggregate.status).toBe("COMPLETED");
  });

  it("rejects an invalid cancel reason before writing", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(pickupInput(), world.deps());
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const canceled = await cancelOrder(
      {
        orderId: placed.value.orderId,
        actor: { type: "CUSTOMER" },
        reason: "   ",
      },
      world.cancelDeps(),
    );
    expect(canceled.ok).toBe(false);
    if (canceled.ok) return;
    expect(canceled.error.code).toBe(
      CHECKOUT_ERROR_CODES.INVALID_CANCEL_REASON,
    );
    expect(world.onlyOrder().aggregate.status).toBe("PENDING");
  });

  it("rejects a missing order", async () => {
    const world = new MemoryCheckout();
    const canceled = await cancelOrder(
      {
        orderId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        ...customerCancel,
      },
      world.cancelDeps(),
    );
    expect(canceled.ok).toBe(false);
    if (canceled.ok) return;
    expect(canceled.error.code).toBe(CHECKOUT_ERROR_CODES.ORDER_NOT_FOUND);
  });
});

describe("placeOrder + cancelOrder stock symmetry", () => {
  it("returns stock to the original quantity and ignores a second cancel", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(
      pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 2 }] }),
      world.deps(),
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(world.productStock(PROD_TRACKED_ID)).toBe(3);
    const canceled = await cancelOrder(
      { orderId: placed.value.orderId, ...customerCancel },
      world.cancelDeps(),
    );
    expect(canceled.ok).toBe(true);
    expect(world.productStock(PROD_TRACKED_ID)).toBe(5);
    await cancelOrder(
      { orderId: placed.value.orderId, ...customerCancel },
      world.cancelDeps(),
    );
    expect(world.productStock(PROD_TRACKED_ID)).toBe(5);
  });
});

describe("open-order stock integrity", () => {
  it("rejects TRACKED to NOT_TRACKED while a PENDING Order holds stock", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(
      pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 2 }] }),
      world.deps(),
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(world.productStock(PROD_TRACKED_ID)).toBe(3);
    const changed = await updateProductUseCase(
      MERCHANT_ID,
      PROD_TRACKED_ID,
      { stockMode: "NOT_TRACKED" },
      world.catalogDeps(),
    );
    expect(changed.ok).toBe(false);
    if (!changed.ok) {
      expect(changed.error.code).toBe(PRODUCT_HAS_OPEN_ORDERS);
    }
    expect(
      world.writeProducts.find((row) => row.id === PROD_TRACKED_ID)?.stockMode,
    ).toBe("TRACKED");
    const canceled = await cancelOrder(
      { orderId: placed.value.orderId, ...customerCancel },
      world.cancelDeps(),
    );
    expect(canceled.ok).toBe(true);
    expect(world.productStock(PROD_TRACKED_ID)).toBe(5);
    await cancelOrder(
      { orderId: placed.value.orderId, ...customerCancel },
      world.cancelDeps(),
    );
    expect(world.productStock(PROD_TRACKED_ID)).toBe(5);
  });

  it("rejects hard delete while an Order is open and allows it after cancel", async () => {
    const world = new MemoryCheckout();
    const placed = await placeOrder(
      pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 2 }] }),
      world.deps(),
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const blocked = await deleteProductUseCase(
      MERCHANT_ID,
      PROD_TRACKED_ID,
      world.catalogDeps(),
    );
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error.code).toBe(PRODUCT_HAS_OPEN_ORDERS);
    }
    expect(world.writeProducts.some((row) => row.id === PROD_TRACKED_ID)).toBe(
      true,
    );
    await cancelOrder(
      { orderId: placed.value.orderId, ...customerCancel },
      world.cancelDeps(),
    );
    const deleted = await deleteProductUseCase(
      MERCHANT_ID,
      PROD_TRACKED_ID,
      world.catalogDeps(),
    );
    expect(deleted.ok).toBe(true);
    expect(world.writeProducts.some((row) => row.id === PROD_TRACKED_ID)).toBe(
      false,
    );
  });

  it("serializes concurrent placeOrder and stock_mode change", async () => {
    const world = new MemoryCheckout();
    const [placed, changed] = await Promise.all([
      placeOrder(
        pickupInput({ lines: [{ productId: PROD_TRACKED_ID, quantity: 2 }] }),
        world.deps(),
      ),
      updateProductUseCase(
        MERCHANT_ID,
        PROD_TRACKED_ID,
        { stockMode: "NOT_TRACKED" },
        world.catalogDeps(),
      ),
    ]);
    const live = world.writeProducts.find((row) => row.id === PROD_TRACKED_ID)!;
    const hasOpen = world.hasOpenNonTerminalOrders(
      MERCHANT_ID,
      PROD_TRACKED_ID,
    );
    if (hasOpen && live.stockMode === "TRACKED") {
      expect(placed.ok).toBe(true);
      expect(changed.ok).toBe(false);
      expect(live.stockQuantity).toBe(3);
    } else {
      expect(changed.ok).toBe(true);
      expect(live.stockMode).toBe("NOT_TRACKED");
      expect(live.stockQuantity).toBeNull();
    }
    expect(
      hasOpen && live.stockMode === "NOT_TRACKED" && live.stockQuantity === 3,
    ).toBe(false);
  });
});

describe("placeOrder quote fingerprint", () => {
  it("creates an Order when the expected fingerprint matches", async () => {
    const world = new MemoryCheckout();
    const deps = world.deps();
    const input = pickupInput();
    const prepared = await prepareOrder(input, deps);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const result = await placeOrder(
      {
        ...input,
        expectedQuoteFingerprint: buildQuoteFingerprint(prepared.value),
      },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.replayed).toBe(false);
    expect(world.orders.size).toBe(1);
  });

  it("requires a new review when the live price changes", async () => {
    const world = new MemoryCheckout();
    const deps = world.deps();
    const input = pickupInput();
    const prepared = await prepareOrder(input, deps);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const fingerprint = buildQuoteFingerprint(prepared.value);
    world.catalogProducts = [simpleProduct({ priceCents: 200000 })];
    const result = await placeOrder(
      { ...input, expectedQuoteFingerprint: fingerprint },
      deps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(
      CHECKOUT_ERROR_CODES.CHECKOUT_REVIEW_REQUIRED,
    );
    expect(result.error.review?.totalCents).toBe(200000);
    expect(world.orders.size).toBe(0);
  });

  it("requires a new review when the delivery fee changes", async () => {
    const world = new MemoryCheckout();
    const deps = world.deps();
    const input = deliveryInput();
    const prepared = await prepareOrder(input, deps);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const fingerprint = buildQuoteFingerprint(prepared.value);
    world.zones = [{ ...deliveryZone(), deliveryFeeCents: 44000 }];
    const result = await placeOrder(
      { ...input, expectedQuoteFingerprint: fingerprint },
      deps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(
      CHECKOUT_ERROR_CODES.CHECKOUT_REVIEW_REQUIRED,
    );
    expect(result.error.review?.deliveryFeeCents).toBe(44000);
    expect(world.orders.size).toBe(0);
  });

  it("requires a new review when payment instructions change", async () => {
    const world = new MemoryCheckout();
    const deps = world.deps();
    const input = pickupInput();
    const prepared = await prepareOrder(input, deps);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const fingerprint = buildQuoteFingerprint(prepared.value);
    world.payments = [
      { ...cashPayment(), instructions: "Nuevo alias" },
      transferPayment(),
    ];
    const result = await placeOrder(
      { ...input, expectedQuoteFingerprint: fingerprint },
      deps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(
      CHECKOUT_ERROR_CODES.CHECKOUT_REVIEW_REQUIRED,
    );
    expect(result.error.review?.payment.instructions).toBe("Nuevo alias");
    expect(world.orders.size).toBe(0);
  });

  it("does not create an Order when stock is insufficient after review", async () => {
    const world = new MemoryCheckout();
    world.catalogProducts = [trackedProduct({ stockQuantity: 5 })];
    world.writeProducts = world.catalogProducts;
    const deps = world.deps();
    const input = pickupInput({
      lines: [{ productId: PROD_TRACKED_ID, quantity: 2 }],
    });
    const prepared = await prepareOrder(input, deps);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    world.catalogProducts = [trackedProduct({ stockQuantity: 1 })];
    world.writeProducts = world.catalogProducts;
    const result = await placeOrder(
      {
        ...input,
        expectedQuoteFingerprint: buildQuoteFingerprint(prepared.value),
      },
      deps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(CHECKOUT_ERROR_CODES.INSUFFICIENT_STOCK);
    expect(world.orders.size).toBe(0);
  });

  it("does not create an Order when the merchant is paused after review", async () => {
    const world = new MemoryCheckout();
    const deps = world.deps();
    const input = pickupInput();
    const prepared = await prepareOrder(input, deps);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    world.catalogMerchant = merchant({ acceptingOrders: false });
    world.writeMerchant = world.catalogMerchant;
    const result = await placeOrder(
      {
        ...input,
        expectedQuoteFingerprint: buildQuoteFingerprint(prepared.value),
      },
      deps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(CHECKOUT_ERROR_CODES.MERCHANT_NOT_ACCEPTING);
    expect(world.orders.size).toBe(0);
  });

  it("does not create an Order when a product becomes unavailable after review", async () => {
    const world = new MemoryCheckout();
    const deps = world.deps();
    const input = pickupInput();
    const prepared = await prepareOrder(input, deps);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    world.catalogProducts = [simpleProduct({ available: false })];
    world.writeProducts = world.catalogProducts;
    const result = await placeOrder(
      {
        ...input,
        expectedQuoteFingerprint: buildQuoteFingerprint(prepared.value),
      },
      deps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(CHECKOUT_ERROR_CODES.PRODUCT_NOT_SELLABLE);
    expect(world.orders.size).toBe(0);
  });

  it("replays an existing Order even if the live price later changed", async () => {
    const world = new MemoryCheckout();
    const deps = world.deps();
    const input = pickupInput();
    const prepared = await prepareOrder(input, deps);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const fingerprint = buildQuoteFingerprint(prepared.value);
    const first = await placeOrder(
      { ...input, expectedQuoteFingerprint: fingerprint },
      deps,
    );
    expect(first.ok).toBe(true);
    world.catalogProducts = [simpleProduct({ priceCents: 880000 })];
    const second = await placeOrder(
      { ...input, expectedQuoteFingerprint: "stale-or-wrong-fingerprint" },
      deps,
    );
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.replayed).toBe(true);
    expect(second.value.orderId).toBe(first.value.orderId);
    expect(second.value.totalCents).toBe(first.value.totalCents);
    expect(world.orders.size).toBe(1);
  });

  it("replays an existing Order even if tracked stock is now 0", async () => {
    const world = new MemoryCheckout();
    world.catalogProducts = [trackedProduct({ stockQuantity: 1 })];
    world.writeProducts = world.catalogProducts;
    const deps = world.deps();
    const input = pickupInput({
      lines: [{ productId: PROD_TRACKED_ID, quantity: 1 }],
    });
    const prepared = await prepareOrder(input, deps);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const first = await placeOrder(
      {
        ...input,
        expectedQuoteFingerprint: buildQuoteFingerprint(prepared.value),
      },
      deps,
    );
    expect(first.ok).toBe(true);
    expect(world.productStock(PROD_TRACKED_ID)).toBe(0);
    const second = await placeOrder(
      {
        ...input,
        expectedQuoteFingerprint: buildQuoteFingerprint(prepared.value),
      },
      deps,
    );
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.replayed).toBe(true);
    expect(world.orders.size).toBe(1);
    expect(world.productStock(PROD_TRACKED_ID)).toBe(0);
  });

  it("rejects the same key with a different intent", async () => {
    const world = new MemoryCheckout();
    const deps = world.deps();
    const first = await placeOrder(pickupInput(), deps);
    expect(first.ok).toBe(true);
    const second = await placeOrder(
      pickupInput({ paymentMethodCode: "TRANSFER" }),
      deps,
    );
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe(CHECKOUT_ERROR_CODES.IDEMPOTENCY_CONFLICT);
    expect(world.orders.size).toBe(1);
  });
});
