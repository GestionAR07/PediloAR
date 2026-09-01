/**
 * Write path of the real order-lifecycle harness.
 * Imported only AFTER identity and environment guards succeed.
 */
import { and, count, eq, ilike, inArray } from "drizzle-orm";
import {
  createProduct,
  updateProduct,
  type ProductDeps,
} from "@/application/catalog/products";
import { cancelOrder } from "@/application/checkout/cancel-order";
import { CHECKOUT_ERROR_CODES } from "@/application/checkout/errors";
import { placeOrder } from "@/application/checkout/place-order";
import type {
  PrepareOrderInput,
  PreparedOrder,
} from "@/application/checkout/types";
import { PRODUCT_HAS_OPEN_ORDERS } from "@/domain/catalog/open-order-integrity";
import { isMerchantOperationallyAcceptingOrders } from "@/domain/merchant/operational-availability";
import { closeDb, getDb } from "@/infrastructure/db/client";
import {
  findMerchantCategoryById,
  findProductById,
  insertProduct,
  listActiveMerchantCategories,
  nextProductSortOrder,
  productHasOpenNonTerminalOrders,
  setProductAvailability,
  updateProduct as updateProductRow,
  deleteProduct as deleteProductRow,
} from "@/infrastructure/db/repositories/catalog-repository";
import {
  cancelOrderInTransaction,
  findOrderByIdempotencyKey,
  persistPreparedOrderInTransaction,
} from "@/infrastructure/db/repositories/checkout-order-repository";
import {
  findMerchantForCheckout,
  listDeliveryZonesForCheckout,
  listOpeningIntervalsForCheckout,
  listOptionChoicesForGroupsCheckout,
  listOptionGroupsForProductsCheckout,
  listPaymentMethodsForCheckout,
  listProductsByIdsForCheckout,
} from "@/infrastructure/db/repositories/checkout-repository";
import {
  deliveries,
  merchants,
  orderEvents,
  orderItemOptions,
  orderItems,
  orders,
  products,
} from "@/infrastructure/db/schema";

const MERCHANT_NAME = "Comercio Prueba";
const QA_PRODUCT_PREFIX = "[QA] Lifecycle Stock Test";
const QA_CUSTOMER_NAME = "[QA] Lifecycle Guest";
const QA_CUSTOMER_PHONE = "2804123456";

type TableCounts = {
  orders: number;
  orderEvents: number;
  deliveries: number;
  qaProducts: number;
};

type CapturedIds = {
  merchantId: string | null;
  productId: string | null;
  productName: string | null;
  orderId: string | null;
  idempotencyKey: string | null;
};

export class HarnessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HarnessError";
  }
}

function pass(message: string): void {
  console.log(`[PASS] ${message}`);
}

function fail(message: string): never {
  throw new HarnessError(`[FAIL] ${message}`);
}

function catalogDeps(): ProductDeps {
  return {
    requireCatalogAccess: async () => undefined,
    findMerchantCategoryById,
    findProductById,
    nextProductSortOrder,
    insertProduct,
    updateProduct: updateProductRow,
    setProductAvailability,
    productHasOpenNonTerminalOrders,
    deleteProduct: deleteProductRow,
  };
}

function checkoutPlaceDeps() {
  return {
    now: () => new Date(),
    findMerchantById: findMerchantForCheckout,
    listProductsByIds: listProductsByIdsForCheckout,
    listOptionGroupsForProducts: listOptionGroupsForProductsCheckout,
    listOptionChoicesForGroups: listOptionChoicesForGroupsCheckout,
    listPaymentMethodsForMerchant: listPaymentMethodsForCheckout,
    listDeliveryZonesForMerchant: listDeliveryZonesForCheckout,
    listOpeningIntervals: listOpeningIntervalsForCheckout,
    findOrderByIdempotencyKey,
    persistPreparedOrder: (prepared: PreparedOrder) =>
      persistPreparedOrderInTransaction(prepared, new Date()),
  };
}

async function tableCounts(): Promise<TableCounts> {
  const db = getDb();
  const [orderCount] = await db.select({ value: count() }).from(orders);
  const [eventCount] = await db.select({ value: count() }).from(orderEvents);
  const [deliveryCount] = await db.select({ value: count() }).from(deliveries);
  const [qaCount] = await db
    .select({ value: count() })
    .from(products)
    .where(ilike(products.name, `${QA_PRODUCT_PREFIX}%`));
  return {
    orders: Number(orderCount?.value ?? 0),
    orderEvents: Number(eventCount?.value ?? 0),
    deliveries: Number(deliveryCount?.value ?? 0),
    qaProducts: Number(qaCount?.value ?? 0),
  };
}

async function loadOrderBundle(orderId: string) {
  const db = getDb();
  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      fulfillmentMethod: orders.fulfillmentMethod,
      deliveryFeeCents: orders.deliveryFeeCents,
      customerNameSnapshot: orders.customerNameSnapshot,
      merchantNameSnapshot: orders.merchantNameSnapshot,
      idempotencyKey: orders.idempotencyKey,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  const items = await db
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      productNameSnapshot: orderItems.productNameSnapshot,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const events = await db
    .select({
      id: orderEvents.id,
      fromStatus: orderEvents.fromStatus,
      toStatus: orderEvents.toStatus,
    })
    .from(orderEvents)
    .where(eq(orderEvents.orderId, orderId));

  const deliveryRows = await db
    .select({ id: deliveries.id })
    .from(deliveries)
    .where(eq(deliveries.orderId, orderId));

  return { order, items, events, deliveries: deliveryRows };
}

async function cleanupCaptured(captured: CapturedIds): Promise<string[]> {
  const leftovers: string[] = [];
  const db = getDb();

  if (captured.orderId) {
    const itemRows = await db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.orderId, captured.orderId));
    const itemIds = itemRows.map((row) => row.id);

    await db.delete(deliveries).where(eq(deliveries.orderId, captured.orderId));

    if (itemIds.length > 0) {
      await db
        .delete(orderItemOptions)
        .where(inArray(orderItemOptions.orderItemId, itemIds));
    }

    await db.delete(orderItems).where(eq(orderItems.orderId, captured.orderId));
    await db
      .delete(orderEvents)
      .where(eq(orderEvents.orderId, captured.orderId));
    await db.delete(orders).where(eq(orders.id, captured.orderId));
  }

  if (captured.productId && captured.merchantId && captured.productName) {
    await db
      .delete(products)
      .where(
        and(
          eq(products.id, captured.productId),
          eq(products.merchantId, captured.merchantId),
          eq(products.name, captured.productName),
        ),
      );
  }

  if (captured.orderId) {
    const stillOrder = await loadOrderBundle(captured.orderId);
    if (stillOrder.order) leftovers.push(`order=${captured.orderId}`);
    if (stillOrder.events.length > 0) {
      leftovers.push(`order_events=${captured.orderId}`);
    }
    if (stillOrder.deliveries.length > 0) {
      leftovers.push(`delivery=${captured.orderId}`);
    }
    if (stillOrder.items.length > 0) {
      leftovers.push(`order_items=${captured.orderId}`);
    }
  }

  if (captured.productId) {
    const stillProduct = await findProductById(
      captured.merchantId ?? "",
      captured.productId,
    );
    if (stillProduct) leftovers.push(`product=${captured.productId}`);
  }

  return leftovers;
}

export async function runLifecycleAfterGuards(): Promise<void> {
  const captured: CapturedIds = {
    merchantId: null,
    productId: null,
    productName: null,
    orderId: null,
    idempotencyKey: null,
  };
  let before: TableCounts | null = null;
  let cleanupFailed = false;

  try {
    const db = getDb();
    const merchantRows = await db
      .select({ id: merchants.id, name: merchants.name })
      .from(merchants)
      .where(eq(merchants.name, MERCHANT_NAME));

    if (merchantRows.length === 0) {
      fail(`merchant "${MERCHANT_NAME}" was not found.`);
    }
    if (merchantRows.length > 1) {
      fail(`merchant "${MERCHANT_NAME}" is not unique; refusing to guess.`);
    }

    const merchantId = merchantRows[0]!.id;
    captured.merchantId = merchantId;
    const merchant = await findMerchantForCheckout(merchantId);
    if (!merchant) {
      fail("merchant checkout record could not be loaded.");
    }

    if (merchant.status !== "ACTIVE") {
      fail(`merchant status is ${merchant.status}, expected ACTIVE.`);
    }
    if (
      !isMerchantOperationallyAcceptingOrders(
        {
          status: merchant.status as "DRAFT" | "ACTIVE" | "SUSPENDED",
          acceptingOrders: merchant.acceptingOrders,
          pausedUntil: merchant.pausedUntil,
        },
        new Date(),
      )
    ) {
      fail("merchant is not accepting orders.");
    }
    if (!merchant.pickupEnabled) {
      fail("pickup is not enabled on the merchant.");
    }

    const categories = await listActiveMerchantCategories(merchantId);
    if (categories.length === 0) {
      fail(
        "merchant has no active category. Create one in the catalog before this harness; it will not invent permanent categories.",
      );
    }

    const payments = (await listPaymentMethodsForCheckout(merchantId)).filter(
      (row) => row.active,
    );
    if (payments.length === 0) {
      fail(
        "merchant has no active payment method. Configure one before this harness.",
      );
    }

    const shortId = crypto.randomUUID().slice(0, 8);
    const productName = `${QA_PRODUCT_PREFIX} ${shortId}`;
    const collision = await db
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.merchantId, merchantId),
          eq(products.name, productName),
        ),
      )
      .limit(1);
    if (collision.length > 0) {
      fail("QA product name collided; retry the harness.");
    }

    before = await tableCounts();
    pass("precheck");

    const created = await createProduct(
      merchantId,
      {
        merchantCategoryId: categories[0]!.id,
        name: productName,
        description: "Harness-only TRACKED product. Safe to delete.",
        priceInput: "100",
        active: true,
        available: true,
        stockMode: "TRACKED",
        stockQuantity: 5,
      },
      catalogDeps(),
    );
    if (!created.ok) {
      fail(`product create rejected (${created.error.code}).`);
    }
    captured.productId = created.value.id;
    captured.productName = productName;

    const liveAfterCreate = await findProductById(merchantId, created.value.id);
    if (
      !liveAfterCreate ||
      liveAfterCreate.stockMode !== "TRACKED" ||
      liveAfterCreate.stockQuantity !== 5
    ) {
      fail("QA product was not created as TRACKED stock=5.");
    }
    pass("product created stock=5");

    const idempotencyKey = `qa-lifecycle-${crypto.randomUUID()}`;
    captured.idempotencyKey = idempotencyKey;
    const orderInput: PrepareOrderInput = {
      merchantId,
      customerZoneId: merchant.zoneId,
      customer: {
        name: QA_CUSTOMER_NAME,
        phone: QA_CUSTOMER_PHONE,
      },
      fulfillmentMethod: "PICKUP",
      paymentMethodCode: payments[0]!.code,
      idempotencyKey,
      lines: [{ productId: created.value.id, quantity: 2 }],
    };

    const placed = await placeOrder(orderInput, checkoutPlaceDeps());
    if (!placed.ok) {
      fail(`placeOrder rejected (${placed.error.code}).`);
    }
    captured.orderId = placed.value.orderId;

    const bundle = await loadOrderBundle(placed.value.orderId);
    if (!bundle.order) {
      fail("created order row was not found.");
    }
    if (bundle.order.status !== "PENDING") {
      fail(`order status is ${bundle.order.status}, expected PENDING.`);
    }
    if (bundle.order.fulfillmentMethod !== "PICKUP") {
      fail("order fulfillment is not PICKUP.");
    }
    if (Number(bundle.order.deliveryFeeCents) !== 0) {
      fail("pickup delivery fee is not 0.");
    }
    if (bundle.order.customerNameSnapshot !== QA_CUSTOMER_NAME) {
      fail("customer name snapshot mismatch.");
    }
    if (bundle.order.merchantNameSnapshot !== MERCHANT_NAME) {
      fail("merchant name snapshot mismatch.");
    }
    if (bundle.items.length !== 1 || bundle.items[0]?.quantity !== 2) {
      fail("expected exactly one order item with quantity 2.");
    }
    if (bundle.items[0]?.productNameSnapshot !== productName) {
      fail("product name snapshot mismatch.");
    }
    if (bundle.events.length !== 1) {
      fail(`expected 1 creation event, found ${bundle.events.length}.`);
    }
    if (
      bundle.events[0]?.fromStatus !== null ||
      bundle.events[0]?.toStatus !== "PENDING"
    ) {
      fail("creation event must be null -> PENDING.");
    }
    if (bundle.deliveries.length !== 0) {
      fail("PICKUP order must not have a Delivery.");
    }
    pass(
      `order created id=${placed.value.orderId} status=PENDING qty=2 pickup fee=0`,
    );

    const stockAfterPlace = await findProductById(merchantId, created.value.id);
    if (stockAfterPlace?.stockQuantity !== 3) {
      fail(
        `stock after placeOrder is ${stockAfterPlace?.stockQuantity}, expected 3.`,
      );
    }
    pass("stock 5 -> 3");

    const replayed = await placeOrder(orderInput, checkoutPlaceDeps());
    if (!replayed.ok) {
      fail(`idempotent retry rejected (${replayed.error.code}).`);
    }
    if (replayed.value.orderId !== placed.value.orderId) {
      fail("retry returned a different orderId.");
    }
    if (replayed.value.replayed !== true) {
      fail("retry did not report replayed=true.");
    }
    const ordersWithKey = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.idempotencyKey, idempotencyKey));
    if (ordersWithKey.length !== 1) {
      fail(`expected 1 order for the key, found ${ordersWithKey.length}.`);
    }
    const afterRetry = await loadOrderBundle(placed.value.orderId);
    if (afterRetry.events.length !== 1) {
      fail("retry created extra order events.");
    }
    const stockAfterRetry = await findProductById(merchantId, created.value.id);
    if (stockAfterRetry?.stockQuantity !== 3) {
      fail("retry decremented stock a second time.");
    }
    pass("retry returned same order");
    pass("stock remained 3");

    const blockedMode = await updateProduct(
      merchantId,
      created.value.id,
      { stockMode: "NOT_TRACKED" },
      catalogDeps(),
    );
    if (blockedMode.ok) {
      fail("stock_mode change was allowed while the order is PENDING.");
    }
    if (blockedMode.error.code !== PRODUCT_HAS_OPEN_ORDERS) {
      fail(
        `stock_mode guard returned ${blockedMode.error.code}, expected ${PRODUCT_HAS_OPEN_ORDERS}.`,
      );
    }
    const stillTracked = await findProductById(merchantId, created.value.id);
    if (
      stillTracked?.stockMode !== "TRACKED" ||
      stillTracked.stockQuantity !== 3
    ) {
      fail("open-order guard did not preserve TRACKED stock=3.");
    }
    pass("stock-mode guard");

    const canceled = await cancelOrder(
      {
        orderId: placed.value.orderId,
        actor: { type: "SYSTEM" },
        reason: "OTHER",
      },
      {
        now: () => new Date(),
        cancelOrderInTransaction,
      },
    );
    if (!canceled.ok) {
      fail(`cancelOrder rejected (${canceled.error.code}).`);
    }
    const afterCancel = await loadOrderBundle(placed.value.orderId);
    if (afterCancel.order?.status !== "CANCELED") {
      fail("order status is not CANCELED.");
    }
    if (afterCancel.events.length !== 2) {
      fail(
        `expected 2 events after cancel, found ${afterCancel.events.length}.`,
      );
    }
    const cancelEvent = afterCancel.events.find(
      (event) => event.toStatus === "CANCELED",
    );
    if (!cancelEvent || cancelEvent.fromStatus !== "PENDING") {
      fail("cancel event must be PENDING -> CANCELED.");
    }
    if (afterCancel.deliveries.length !== 0) {
      fail("cancel created a Delivery.");
    }
    pass("cancel");

    const stockAfterCancel = await findProductById(
      merchantId,
      created.value.id,
    );
    if (stockAfterCancel?.stockQuantity !== 5) {
      fail(
        `stock after cancel is ${stockAfterCancel?.stockQuantity}, expected 5.`,
      );
    }
    pass("stock 3 -> 5");

    const secondCancel = await cancelOrder(
      {
        orderId: placed.value.orderId,
        actor: { type: "SYSTEM" },
        reason: "OTHER",
      },
      {
        now: () => new Date(),
        cancelOrderInTransaction,
      },
    );
    if (secondCancel.ok) {
      fail("second cancel succeeded.");
    }
    if (
      secondCancel.error.code !== CHECKOUT_ERROR_CODES.ORDER_ALREADY_CANCELED
    ) {
      fail(
        `second cancel returned ${secondCancel.error.code}, expected ORDER_ALREADY_CANCELED.`,
      );
    }
    const afterSecond = await loadOrderBundle(placed.value.orderId);
    if (afterSecond.events.length !== 2) {
      fail("second cancel wrote another event.");
    }
    const stockAfterSecond = await findProductById(
      merchantId,
      created.value.id,
    );
    if (stockAfterSecond?.stockQuantity !== 5) {
      fail("second cancel changed stock.");
    }
    pass("duplicate cancel blocked");

    const allowedMode = await updateProduct(
      merchantId,
      created.value.id,
      { stockMode: "NOT_TRACKED" },
      catalogDeps(),
    );
    if (!allowedMode.ok) {
      fail(
        `stock_mode change after cancel was rejected (${allowedMode.error.code}).`,
      );
    }
    const afterMode = await findProductById(merchantId, created.value.id);
    if (afterMode?.stockMode !== "NOT_TRACKED") {
      fail("terminal order still blocked stock_mode change.");
    }
    pass("terminal order no longer blocks stock_mode");
  } finally {
    try {
      const leftovers = await cleanupCaptured(captured);
      if (leftovers.length > 0) {
        cleanupFailed = true;
        console.error(
          `[FAIL] cleanup leftover IDs (manual delete required): ${leftovers.join(", ")}`,
        );
      } else if (before) {
        const after = await tableCounts();
        const countsMatch =
          after.orders === before.orders &&
          after.orderEvents === before.orderEvents &&
          after.deliveries === before.deliveries &&
          after.qaProducts === before.qaProducts;
        if (!countsMatch) {
          cleanupFailed = true;
          console.error(
            "[FAIL] table counts did not return to the precheck snapshot.",
          );
        } else {
          pass("cleanup");
        }
      }
    } catch (error) {
      cleanupFailed = true;
      const ids = [
        captured.productId ? `product=${captured.productId}` : null,
        captured.orderId ? `order=${captured.orderId}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      console.error(
        `[FAIL] cleanup threw. Manual IDs: ${ids || "(none captured)"}`,
      );
      if (error instanceof Error) {
        console.error(error.message);
      }
    }
    await closeDb();
  }

  if (cleanupFailed) {
    fail("cleanup verification failed.");
  }
}
