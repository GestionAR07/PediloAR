import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { moneyCentsColumn } from "../money-mapping";
import { createdAtColumn, idColumn, updatedAtColumn } from "./columns";
import {
  CANCEL_REASON_VALUES,
  FULFILLMENT_METHOD_VALUES,
  ORDER_ACTOR_TYPE_VALUES,
  ORDER_STATUS_VALUES,
  PAYMENT_METHOD_CODE_VALUES,
  sqlInList,
} from "./enums";
import { cities, zones } from "./geo";
import { merchants } from "./merchant";
import { productOptionChoices, productOptionGroups, products } from "./catalog";

/**
 * Commercial order. NO delivery_id column — Delivery.order_id is the only link.
 *
 * Idempotency: GLOBAL UNIQUE(idempotency_key).
 * Keys are client-supplied high-entropy tokens (UUID/secure). Domain already
 * validates shape; DB enforces uniqueness as a creation-attempt identity
 * across the marketplace. Scoped alternatives (merchant/customer) were rejected
 * because secure random keys make collisions negligible and checkout retries
 * must short-circuit the same payload regardless of identity timing.
 */
export const orders = pgTable(
  "orders",
  {
    id: idColumn(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "restrict" }),
    /**
     * Future Auth subject (customer). Nullable for guest flow later.
     * No FK until Auth strategy is approved — opaque UUID only.
     */
    customerUserId: uuid("customer_user_id"),
    status: text("status").notNull().default("PENDING"),
    fulfillmentMethod: text("fulfillment_method").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    itemSubtotalCents: moneyCentsColumn("item_subtotal_cents").notNull(),
    optionsSubtotalCents: moneyCentsColumn("options_subtotal_cents").notNull(),
    orderSubtotalCents: moneyCentsColumn("order_subtotal_cents").notNull(),
    deliveryFeeCents: moneyCentsColumn("delivery_fee_cents").notNull(),
    totalCents: moneyCentsColumn("total_cents").notNull(),
    paymentMethodCode: text("payment_method_code").notNull(),
    paymentMethodLabel: text("payment_method_label").notNull(),
    paymentMethodInstructions: text("payment_method_instructions")
      .notNull()
      .default(""),
    // Delivery address snapshot columns (null for PICKUP)
    deliveryCityId: uuid("delivery_city_id").references(() => cities.id, {
      onDelete: "set null",
    }),
    deliveryZoneId: uuid("delivery_zone_id").references(() => zones.id, {
      onDelete: "set null",
    }),
    /** Frozen labels so renames of City/Zone never rewrite history presentation. */
    deliveryCityNameSnapshot: text("delivery_city_name_snapshot"),
    deliveryZoneNameSnapshot: text("delivery_zone_name_snapshot"),
    deliveryStreet: text("delivery_street"),
    deliveryNumber: text("delivery_number"),
    deliveryFloorApartment: text("delivery_floor_apartment"),
    deliveryReference: text("delivery_reference"),
    canceledAt: timestamp("canceled_at", {
      withTimezone: true,
      mode: "date",
    }),
    canceledBy: text("canceled_by"),
    cancelReason: text("cancel_reason"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("orders_idempotency_key_uidx").on(table.idempotencyKey),
    index("orders_merchant_id_idx").on(table.merchantId),
    index("orders_merchant_status_idx").on(table.merchantId, table.status),
    index("orders_merchant_created_at_idx").on(
      table.merchantId,
      table.createdAt,
    ),
    index("orders_customer_user_id_idx").on(table.customerUserId),
    index("orders_status_created_at_idx").on(table.status, table.createdAt),
    check(
      "orders_status_check",
      sql.raw(`status IN (${sqlInList(ORDER_STATUS_VALUES)})`),
    ),
    check(
      "orders_fulfillment_method_check",
      sql.raw(
        `fulfillment_method IN (${sqlInList(FULFILLMENT_METHOD_VALUES)})`,
      ),
    ),
    check(
      "orders_payment_method_code_check",
      sql.raw(
        `payment_method_code IN (${sqlInList(PAYMENT_METHOD_CODE_VALUES)})`,
      ),
    ),
    check(
      "orders_canceled_by_check",
      sql.raw(
        `canceled_by IS NULL OR canceled_by IN (${sqlInList(ORDER_ACTOR_TYPE_VALUES)})`,
      ),
    ),
    check(
      "orders_cancel_reason_check",
      sql.raw(
        `cancel_reason IS NULL OR cancel_reason IN (${sqlInList(CANCEL_REASON_VALUES)})`,
      ),
    ),
    check(
      "orders_idempotency_key_shape",
      sql`char_length(${table.idempotencyKey}) >= 8 AND char_length(${table.idempotencyKey}) <= 128 AND ${table.idempotencyKey} ~ '^[A-Za-z0-9._~-]+$'`,
    ),
  ],
);

/**
 * Historical line items. product_id is SET NULL on product hard-delete
 * so commercial history never cascades away with catalog mutation.
 */
export const orderItems = pgTable(
  "order_items",
  {
    id: idColumn(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    productNameSnapshot: text("product_name_snapshot").notNull(),
    unitPriceCents: moneyCentsColumn("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalCents: moneyCentsColumn("line_total_cents").notNull(),
    itemNotes: text("item_notes").notNull().default(""),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("order_items_order_id_idx").on(table.orderId),
    check("order_items_quantity_positive", sql`${table.quantity} >= 1`),
    check(
      "order_items_name_not_blank",
      sql`length(btrim(${table.productNameSnapshot})) > 0`,
    ),
  ],
);

/** Option snapshots attached to order lines — independent of live catalog. */
export const orderItemOptions = pgTable(
  "order_item_options",
  {
    id: idColumn(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "restrict" }),
    optionGroupId: uuid("option_group_id").references(
      () => productOptionGroups.id,
      { onDelete: "set null" },
    ),
    optionChoiceId: uuid("option_choice_id").references(
      () => productOptionChoices.id,
      { onDelete: "set null" },
    ),
    optionGroupNameSnapshot: text("option_group_name_snapshot").notNull(),
    optionChoiceNameSnapshot: text("option_choice_name_snapshot").notNull(),
    priceDeltaCents: moneyCentsColumn("price_delta_cents").notNull(),
    quantity: integer("quantity").notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("order_item_options_order_item_id_idx").on(table.orderItemId),
    check("order_item_options_quantity_positive", sql`${table.quantity} >= 1`),
    check(
      "order_item_options_group_name_not_blank",
      sql`length(btrim(${table.optionGroupNameSnapshot})) > 0`,
    ),
    check(
      "order_item_options_choice_name_not_blank",
      sql`length(btrim(${table.optionChoiceNameSnapshot})) > 0`,
    ),
  ],
);

/**
 * Immutable-ish audit trail. FK RESTRICT so ordinary cleanup cannot drop history
 * without an explicit, deliberate order retention policy later.
 */
export const orderEvents = pgTable(
  "order_events",
  {
    id: idColumn(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    reason: text("reason"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("order_events_order_id_idx").on(table.orderId),
    index("order_events_order_created_at_idx").on(
      table.orderId,
      table.createdAt,
    ),
    check(
      "order_events_from_status_check",
      sql.raw(
        `from_status IS NULL OR from_status IN (${sqlInList(ORDER_STATUS_VALUES)})`,
      ),
    ),
    check(
      "order_events_to_status_check",
      sql.raw(`to_status IN (${sqlInList(ORDER_STATUS_VALUES)})`),
    ),
    check(
      "order_events_actor_type_check",
      sql.raw(`actor_type IN (${sqlInList(ORDER_ACTOR_TYPE_VALUES)})`),
    ),
  ],
);
