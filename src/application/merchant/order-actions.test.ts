import { describe, expect, it, vi } from "vitest";
import { AuthzError } from "@/server/auth/errors";
import { CHECKOUT_ERROR_CODES } from "@/application/checkout/errors";
import { cancelOrder } from "@/application/checkout/cancel-order";
import type {
  CancelOrderCommand,
  CancelOrderPersistResult,
} from "@/application/checkout/types";
import { canCancelOrder } from "@/domain/order/cancellation";
import { canCompleteOrder } from "@/domain/order/completion";
import type { DeliveryStatus } from "@/domain/delivery/enums";
import type { FulfillmentMethod, OrderStatus } from "@/domain/order/enums";
import { assertOrderDeliveryCompatibility } from "@/domain/order/fulfillment-compat";
import { transitionOrderStatus } from "@/domain/order/transitions";
import {
  acceptMerchantOrder,
  completeMerchantPickupOrder,
  isMerchantRejectReason,
  markMerchantOrderReady,
  MERCHANT_REJECT_REASONS,
  rejectMerchantOrder,
  startPreparingMerchantOrder,
  type CompleteMerchantPickupCommand,
  type CompleteMerchantPickupPersistResult,
  type MerchantOrderActionDeps,
} from "./order-actions";
import {
  decideMerchantOperationalTransition,
  parseLockedOrderStatus,
  type MerchantOrderTransitionPersistResult,
  type TransitionMerchantOrderCommand,
} from "./order-transitions";

const MERCHANT_A = "11111111-1111-4111-8111-111111111111";
const MERCHANT_B = "22222222-2222-4222-8222-222222222222";
const ORDER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MISSING = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OWNER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const STAFF_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const NOW = new Date("2026-08-14T14:30:00.000Z");

type StoredEvent = {
  fromStatus: string | null;
  toStatus: string;
  actorType: string;
  actorId: string | null;
  reason: string | null;
};

type StoredOrder = {
  merchantId: string;
  id: string;
  status: string;
  fulfillmentMethod: string;
  stockQuantity: number;
  deliveryStatus: string | null;
  events: StoredEvent[];
  canceledBy: string | null;
  cancelReason: string | null;
};

class SerialLock {
  private tail: Promise<void> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const wait = this.tail;
    this.tail = next;
    return wait.then(fn).finally(() => release());
  }
}

function seed(
  status = "PENDING",
  overrides: Partial<StoredOrder> = {},
): StoredOrder {
  return {
    merchantId: MERCHANT_A,
    id: ORDER_A,
    status,
    fulfillmentMethod: "PICKUP",
    stockQuantity: 2,
    deliveryStatus: "PENDING",
    events: [],
    canceledBy: null,
    cancelReason: null,
    ...overrides,
  };
}

function memoryOps(
  orders: StoredOrder[],
  access: MerchantOrderActionDeps["requireMerchantOrderAccess"] = vi.fn(
    async () => undefined,
  ),
  options: { failOn?: "complete-update" | "complete-event" } = {},
): {
  orders: StoredOrder[];
  deps: MerchantOrderActionDeps;
  writes: { stock: number; delivery: number };
} {
  const lock = new SerialLock();
  const writes = { stock: 0, delivery: 0 };

  async function transitionMerchantOrderInTransaction(
    command: TransitionMerchantOrderCommand,
  ): Promise<MerchantOrderTransitionPersistResult> {
    return lock.run(async () => {
      const stored = orders.find(
        (row) =>
          row.id === command.orderId && row.merchantId === command.merchantId,
      );
      if (!stored) {
        return {
          status: "rejected",
          error: {
            code: "ORDER_NOT_FOUND",
            message: "El pedido no existe.",
          },
        };
      }
      const current = parseLockedOrderStatus(stored.status);
      if (!current.ok) {
        return { status: "rejected", error: current.error };
      }
      const next = decideMerchantOperationalTransition(
        current.value,
        command.targetStatus,
      );
      if (!next.ok) {
        return { status: "rejected", error: next.error };
      }
      stored.status = next.value;
      stored.events.push({
        fromStatus: current.value,
        toStatus: next.value,
        actorType: "MERCHANT_USER",
        actorId: command.actorUserId,
        reason: null,
      });
      return {
        status: "transitioned",
        result: {
          orderId: stored.id,
          previousStatus: current.value,
          status: next.value,
        },
      };
    });
  }

  async function cancelOrderInTransaction(
    command: CancelOrderCommand,
  ): Promise<CancelOrderPersistResult> {
    return lock.run(async () => {
      const stored = orders.find((row) => {
        if (row.id !== command.orderId) return false;
        if (
          command.expectedMerchantId &&
          row.merchantId !== command.expectedMerchantId
        ) {
          return false;
        }
        return true;
      });
      if (!stored) {
        return {
          status: "rejected",
          error: {
            code: CHECKOUT_ERROR_CODES.ORDER_NOT_FOUND,
            message: "El pedido no existe.",
          },
        };
      }
      if (stored.status === "CANCELED") {
        return { status: "already_canceled", orderId: stored.id };
      }
      if (
        command.expectedCurrentStatus &&
        stored.status !== command.expectedCurrentStatus
      ) {
        return {
          status: "rejected",
          error: {
            code: CHECKOUT_ERROR_CODES.ORDER_NOT_CANCELABLE,
            message: "El pedido ya no se puede rechazar.",
          },
        };
      }
      const policy = canCancelOrder({
        actor: command.actorType,
        orderStatus: stored.status as OrderStatus,
        delivery: stored.deliveryStatus
          ? { status: stored.deliveryStatus as DeliveryStatus }
          : null,
        cancelReason: command.reason,
      });
      if (!policy.ok) {
        return {
          status: "rejected",
          error: {
            code: CHECKOUT_ERROR_CODES.ORDER_NOT_CANCELABLE,
            message: "No se puede cancelar el pedido.",
          },
        };
      }
      const transition = transitionOrderStatus(
        stored.status as OrderStatus,
        "CANCELED",
      );
      if (!transition.ok) {
        return {
          status: "rejected",
          error: {
            code: CHECKOUT_ERROR_CODES.ORDER_NOT_CANCELABLE,
            message: "No se puede cancelar el pedido.",
          },
        };
      }
      const previous = stored.status;
      stored.status = "CANCELED";
      stored.canceledBy = command.actorType;
      stored.cancelReason = command.reason;
      stored.stockQuantity += 1;
      writes.stock += 1;
      if (stored.deliveryStatus && stored.deliveryStatus !== "DELIVERED") {
        stored.deliveryStatus = "CANCELED";
        writes.delivery += 1;
      }
      stored.events.push({
        fromStatus: previous,
        toStatus: "CANCELED",
        actorType: command.actorType,
        actorId: command.actorId,
        reason: command.reason,
      });
      return {
        status: "canceled",
        result: {
          orderId: stored.id,
          previousStatus: previous,
          status: "CANCELED",
          restoredTrackedQuantity: 1,
          deliveryCanceled: stored.deliveryStatus === "CANCELED",
        },
      };
    });
  }

  async function completeMerchantPickupOrderInTransaction(
    command: CompleteMerchantPickupCommand,
  ): Promise<CompleteMerchantPickupPersistResult> {
    return lock.run(async () => {
      const stored = orders.find(
        (row) =>
          row.id === command.orderId && row.merchantId === command.merchantId,
      );
      if (!stored) {
        return {
          status: "rejected",
          error: {
            code: "ORDER_NOT_FOUND",
            message: "El pedido no existe.",
          },
        };
      }

      const snapshot = {
        status: stored.status,
        stockQuantity: stored.stockQuantity,
        deliveryStatus: stored.deliveryStatus,
        events: [...stored.events],
      };

      try {
        if (stored.status === "COMPLETED") {
          return {
            status: "rejected",
            error: {
              code: "ORDER_TRANSITION_NOOP",
              message: "El pedido ya fue procesado.",
            },
          };
        }
        if (stored.status === "CANCELED") {
          return {
            status: "rejected",
            error: {
              code: "ORDER_TRANSITION_TERMINAL",
              message: "El pedido ya no se puede actualizar.",
            },
          };
        }
        if (stored.fulfillmentMethod !== "PICKUP") {
          return {
            status: "rejected",
            error: {
              code: "ORDER_COMPLETE_WRONG_FULFILLMENT",
              message: "Este pedido no se puede completar como retiro.",
            },
          };
        }

        const delivery = stored.deliveryStatus
          ? {
              provider: "MERCHANT" as const,
              status: stored.deliveryStatus as DeliveryStatus,
            }
          : null;
        const compat = assertOrderDeliveryCompatibility(
          { fulfillmentMethod: "PICKUP" },
          delivery,
        );
        if (!compat.ok) {
          return {
            status: "rejected",
            error: {
              code: compat.error.code,
              message: "No se puede completar el retiro.",
            },
          };
        }

        const complete = canCompleteOrder({
          orderStatus: stored.status as OrderStatus,
          fulfillmentMethod: stored.fulfillmentMethod as FulfillmentMethod,
          delivery,
        });
        if (!complete.ok) {
          return {
            status: "rejected",
            error: {
              code: complete.error.code,
              message:
                complete.error.code === "ORDER_COMPLETE_NOT_READY"
                  ? "El pedido ya no se puede completar."
                  : "No se puede completar el pedido.",
            },
          };
        }

        const next = transitionOrderStatus(
          stored.status as OrderStatus,
          "COMPLETED",
        );
        if (!next.ok) {
          return {
            status: "rejected",
            error: {
              code: next.error.code,
              message: "No se puede completar el pedido.",
            },
          };
        }

        if (options.failOn === "complete-update") {
          throw new Error("simulated order update failure");
        }
        const previous = stored.status as OrderStatus;
        stored.status = "COMPLETED";

        if (options.failOn === "complete-event") {
          throw new Error("simulated order_events insert failure");
        }
        stored.events.push({
          fromStatus: previous,
          toStatus: "COMPLETED",
          actorType: "MERCHANT_USER",
          actorId: command.actorUserId,
          reason: null,
        });

        return {
          status: "completed",
          result: {
            orderId: stored.id,
            previousStatus: previous,
            status: "COMPLETED",
          },
        };
      } catch {
        stored.status = snapshot.status;
        stored.stockQuantity = snapshot.stockQuantity;
        stored.deliveryStatus = snapshot.deliveryStatus;
        stored.events.splice(0, stored.events.length, ...snapshot.events);
        return {
          status: "rejected",
          error: {
            code: "ORDER_PERSISTENCE_FAILED",
            message: "No se pudo actualizar el pedido.",
          },
        };
      }
    });
  }

  return {
    orders,
    writes,
    deps: {
      now: () => NOW,
      requireMerchantOrderAccess: access,
      transitionMerchantOrderInTransaction,
      cancelOrderInTransaction,
      completeMerchantPickupOrderInTransaction,
    },
  };
}

describe("acceptMerchantOrder", () => {
  it("allows OWNER to accept PENDING", async () => {
    const { orders, deps } = memoryOps([seed()]);
    const result = await acceptMerchantOrder(
      { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("ACCEPTED");
    expect(result.value.previousStatus).toBe("PENDING");
    expect(orders[0]?.events).toHaveLength(1);
    expect(orders[0]?.events[0]).toMatchObject({
      fromStatus: "PENDING",
      toStatus: "ACCEPTED",
      actorType: "MERCHANT_USER",
      actorId: OWNER_ID,
      reason: null,
    });
    expect(orders[0]?.stockQuantity).toBe(2);
    expect(orders[0]?.deliveryStatus).toBe("PENDING");
    expect(deps.requireMerchantOrderAccess).toHaveBeenCalledWith(MERCHANT_A);
  });

  it("allows STAFF to accept PENDING", async () => {
    const { deps } = memoryOps([seed()]);
    const result = await acceptMerchantOrder(
      { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: STAFF_ID },
      deps,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("ACCEPTED");
    }
  });

  it("denies ADMIN without membership before writing", async () => {
    const { orders, deps } = memoryOps(
      [seed()],
      vi.fn(async () => {
        throw new AuthzError("NOT_MERCHANT_MEMBER", "no");
      }),
    );
    await expect(
      acceptMerchantOrder(
        { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
        deps,
      ),
    ).rejects.toMatchObject({ code: "NOT_MERCHANT_MEMBER" });
    expect(orders[0]?.status).toBe("PENDING");
    expect(orders[0]?.events).toHaveLength(0);
  });

  it("denies merchant B and a missing order", async () => {
    const { orders, deps } = memoryOps([seed()]);
    const foreign = await acceptMerchantOrder(
      { merchantId: MERCHANT_B, orderId: ORDER_A, actorUserId: OWNER_ID },
      deps,
    );
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) {
      expect(foreign.error.code).toBe("ORDER_NOT_FOUND");
      expect(foreign.error.message).toBe("El pedido no existe.");
    }
    const missing = await acceptMerchantOrder(
      { merchantId: MERCHANT_A, orderId: MISSING, actorUserId: OWNER_ID },
      deps,
    );
    expect(missing.ok).toBe(false);
    expect(orders[0]?.status).toBe("PENDING");
    expect(orders[0]?.events).toHaveLength(0);
  });

  it("does not write a second event on double accept", async () => {
    const { orders, deps } = memoryOps([seed()]);
    const first = await acceptMerchantOrder(
      { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
      deps,
    );
    const second = await acceptMerchantOrder(
      { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
      deps,
    );
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe("ORDER_TRANSITION_NOOP");
      expect(second.error.message).toBe("El pedido ya fue procesado.");
    }
    expect(orders[0]?.events).toHaveLength(1);
  });

  it("denies accepting a terminal order", async () => {
    const { orders, deps } = memoryOps([seed("COMPLETED")]);
    const result = await acceptMerchantOrder(
      { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ORDER_TRANSITION_TERMINAL");
    }
    expect(orders[0]?.status).toBe("COMPLETED");
    expect(orders[0]?.events).toHaveLength(0);
  });
});

describe("rejectMerchantOrder", () => {
  it("allows OWNER to reject PENDING with restock and one event", async () => {
    const { orders, deps } = memoryOps([seed("PENDING", { stockQuantity: 2 })]);
    const result = await rejectMerchantOrder(
      {
        merchantId: MERCHANT_A,
        orderId: ORDER_A,
        actorUserId: OWNER_ID,
        reason: "MERCHANT_UNAVAILABLE",
      },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("CANCELED");
    expect(result.value.previousStatus).toBe("PENDING");
    expect(result.value.restoredTrackedQuantity).toBe(1);
    expect(orders[0]?.status).toBe("CANCELED");
    expect(orders[0]?.canceledBy).toBe("MERCHANT_USER");
    expect(orders[0]?.cancelReason).toBe("MERCHANT_UNAVAILABLE");
    expect(orders[0]?.stockQuantity).toBe(3);
    expect(orders[0]?.events).toHaveLength(1);
    expect(orders[0]?.events[0]).toMatchObject({
      fromStatus: "PENDING",
      toStatus: "CANCELED",
      actorType: "MERCHANT_USER",
      actorId: OWNER_ID,
      reason: "MERCHANT_UNAVAILABLE",
    });
  });

  it("allows STAFF to reject PENDING", async () => {
    const { deps } = memoryOps([seed()]);
    const result = await rejectMerchantOrder(
      {
        merchantId: MERCHANT_A,
        orderId: ORDER_A,
        actorUserId: STAFF_ID,
        reason: "OUT_OF_STOCK",
      },
      deps,
    );
    expect(result.ok).toBe(true);
  });

  it("denies merchant B and a missing order without stock or events", async () => {
    const { orders, deps } = memoryOps([seed()]);
    const foreign = await rejectMerchantOrder(
      {
        merchantId: MERCHANT_B,
        orderId: ORDER_A,
        actorUserId: OWNER_ID,
        reason: "OTHER",
      },
      deps,
    );
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) {
      expect(foreign.error.code).toBe("ORDER_NOT_FOUND");
      expect(foreign.error.message).toBe("El pedido no existe.");
    }
    const missing = await rejectMerchantOrder(
      {
        merchantId: MERCHANT_A,
        orderId: MISSING,
        actorUserId: OWNER_ID,
        reason: "OTHER",
      },
      deps,
    );
    expect(missing.ok).toBe(false);
    expect(orders[0]?.status).toBe("PENDING");
    expect(orders[0]?.stockQuantity).toBe(2);
    expect(orders[0]?.events).toHaveLength(0);
  });

  it("does not restock or emit a second event on double reject", async () => {
    const { orders, deps } = memoryOps([seed()]);
    const first = await rejectMerchantOrder(
      {
        merchantId: MERCHANT_A,
        orderId: ORDER_A,
        actorUserId: OWNER_ID,
        reason: "OUT_OF_STOCK",
      },
      deps,
    );
    const second = await rejectMerchantOrder(
      {
        merchantId: MERCHANT_A,
        orderId: ORDER_A,
        actorUserId: OWNER_ID,
        reason: "OUT_OF_STOCK",
      },
      deps,
    );
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe("ORDER_ALREADY_CANCELED");
    }
    expect(orders[0]?.stockQuantity).toBe(3);
    expect(orders[0]?.events).toHaveLength(1);
  });

  it("denies rejecting an ACCEPTED order through the 7.3 action", async () => {
    const { orders, deps } = memoryOps([seed("ACCEPTED")]);
    const result = await rejectMerchantOrder(
      {
        merchantId: MERCHANT_A,
        orderId: ORDER_A,
        actorUserId: OWNER_ID,
        reason: "OTHER",
      },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ORDER_NOT_CANCELABLE");
      expect(result.error.message).toBe("El pedido ya no se puede rechazar.");
    }
    expect(orders[0]?.status).toBe("ACCEPTED");
    expect(orders[0]?.stockQuantity).toBe(2);
    expect(orders[0]?.events).toHaveLength(0);
  });

  it("rejects CUSTOMER_REQUEST and PAYMENT_ISSUE from merchant UI", async () => {
    const persist = memoryOps([seed()]);
    persist.deps.cancelOrderInTransaction = async () => {
      throw new Error("cancel must not run for forbidden reasons");
    };
    const customer = await rejectMerchantOrder(
      {
        merchantId: MERCHANT_A,
        orderId: ORDER_A,
        actorUserId: OWNER_ID,
        reason: "CUSTOMER_REQUEST",
      },
      persist.deps,
    );
    const payment = await rejectMerchantOrder(
      {
        merchantId: MERCHANT_A,
        orderId: ORDER_A,
        actorUserId: OWNER_ID,
        reason: "PAYMENT_ISSUE",
      },
      persist.deps,
    );
    expect(customer.ok).toBe(false);
    expect(payment.ok).toBe(false);
    expect(isMerchantRejectReason("CUSTOMER_REQUEST")).toBe(false);
    expect([...MERCHANT_REJECT_REASONS]).toEqual([
      "MERCHANT_UNAVAILABLE",
      "OUT_OF_STOCK",
      "OTHER",
    ]);
  });
});

describe("accept vs reject interleaved", () => {
  it("lets accept win and then blocks PENDING-only reject", async () => {
    const { orders, deps } = memoryOps([seed()]);
    const [accept, reject] = await Promise.all([
      acceptMerchantOrder(
        { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
        deps,
      ),
      rejectMerchantOrder(
        {
          merchantId: MERCHANT_A,
          orderId: ORDER_A,
          actorUserId: OWNER_ID,
          reason: "OTHER",
        },
        deps,
      ),
    ]);
    expect(Number(accept.ok) + Number(reject.ok)).toBe(1);
    expect(orders[0]?.events).toHaveLength(1);
    if (accept.ok) {
      expect(orders[0]?.status).toBe("ACCEPTED");
      expect(orders[0]?.stockQuantity).toBe(2);
      expect(reject.ok).toBe(false);
    } else {
      expect(orders[0]?.status).toBe("CANCELED");
      expect(orders[0]?.stockQuantity).toBe(3);
      expect(accept.ok).toBe(false);
    }
  });
});

const pickupReady = () =>
  seed("READY", { fulfillmentMethod: "PICKUP", deliveryStatus: null });

describe("startPreparingMerchantOrder", () => {
  it("allows OWNER and STAFF to move ACCEPTED to PREPARING", async () => {
    const owner = memoryOps([seed("ACCEPTED", { deliveryStatus: null })]);
    const staff = memoryOps([seed("ACCEPTED", { deliveryStatus: null })]);
    const asOwner = await startPreparingMerchantOrder(
      { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
      owner.deps,
    );
    const asStaff = await startPreparingMerchantOrder(
      { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: STAFF_ID },
      staff.deps,
    );
    expect(asOwner.ok).toBe(true);
    expect(asStaff.ok).toBe(true);
    if (!asOwner.ok) return;
    expect(asOwner.value).toEqual({
      orderId: ORDER_A,
      previousStatus: "ACCEPTED",
      status: "PREPARING",
    });
    expect(owner.orders[0]?.events).toHaveLength(1);
    expect(owner.orders[0]?.events[0]).toMatchObject({
      fromStatus: "ACCEPTED",
      toStatus: "PREPARING",
      actorType: "MERCHANT_USER",
      actorId: OWNER_ID,
      reason: null,
    });
    expect(owner.orders[0]?.stockQuantity).toBe(2);
    expect(owner.writes.stock).toBe(0);
    expect(owner.writes.delivery).toBe(0);
    expect(owner.orders[0]?.deliveryStatus).toBeNull();
  });

  it("denies ADMIN without membership and merchant B", async () => {
    const admin = memoryOps(
      [seed("ACCEPTED")],
      vi.fn(async () => {
        throw new AuthzError("NOT_MERCHANT_MEMBER", "no");
      }),
    );
    await expect(
      startPreparingMerchantOrder(
        { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
        admin.deps,
      ),
    ).rejects.toMatchObject({ code: "NOT_MERCHANT_MEMBER" });
    expect(admin.orders[0]?.status).toBe("ACCEPTED");
    expect(admin.orders[0]?.events).toHaveLength(0);

    const { orders, deps } = memoryOps([seed("ACCEPTED")]);
    const foreign = await startPreparingMerchantOrder(
      { merchantId: MERCHANT_B, orderId: ORDER_A, actorUserId: OWNER_ID },
      deps,
    );
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) {
      expect(foreign.error.code).toBe("ORDER_NOT_FOUND");
    }
    expect(orders[0]?.status).toBe("ACCEPTED");
    expect(orders[0]?.events).toHaveLength(0);
  });

  it("writes exactly one event and no-ops a double start", async () => {
    const { orders, deps, writes } = memoryOps([
      seed("ACCEPTED", { deliveryStatus: null }),
    ]);
    const [first, second] = await Promise.all([
      startPreparingMerchantOrder(
        { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
        deps,
      ),
      startPreparingMerchantOrder(
        { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
        deps,
      ),
    ]);
    expect(Number(first.ok) + Number(second.ok)).toBe(1);
    expect(orders[0]?.status).toBe("PREPARING");
    expect(orders[0]?.events).toHaveLength(1);
    expect(writes.stock).toBe(0);
    expect(writes.delivery).toBe(0);
  });

  it("denies PENDING and terminal orders without writes", async () => {
    const pending = memoryOps([seed("PENDING")]);
    const canceled = memoryOps([seed("CANCELED")]);
    const fromPending = await startPreparingMerchantOrder(
      { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
      pending.deps,
    );
    const fromCanceled = await startPreparingMerchantOrder(
      { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
      canceled.deps,
    );
    expect(fromPending.ok).toBe(false);
    if (!fromPending.ok) {
      expect(fromPending.error.code).toBe("ORDER_TRANSITION_INVALID");
    }
    expect(fromCanceled.ok).toBe(false);
    if (!fromCanceled.ok) {
      expect(fromCanceled.error.code).toBe("ORDER_TRANSITION_TERMINAL");
    }
    expect(pending.orders[0]?.events).toHaveLength(0);
    expect(canceled.orders[0]?.events).toHaveLength(0);
    expect(pending.writes.stock).toBe(0);
    expect(canceled.writes.stock).toBe(0);
  });
});

describe("markMerchantOrderReady", () => {
  it("moves PREPARING to READY with one event and zero stock/Delivery writes", async () => {
    const { orders, deps, writes } = memoryOps([
      seed("PREPARING", { deliveryStatus: null }),
    ]);
    const result = await markMerchantOrderReady(
      { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("READY");
    expect(result.value.previousStatus).toBe("PREPARING");
    expect(orders[0]?.events).toHaveLength(1);
    expect(orders[0]?.events[0]).toMatchObject({
      fromStatus: "PREPARING",
      toStatus: "READY",
      actorType: "MERCHANT_USER",
      actorId: OWNER_ID,
      reason: null,
    });
    expect(orders[0]?.stockQuantity).toBe(2);
    expect(orders[0]?.deliveryStatus).toBeNull();
    expect(writes.stock).toBe(0);
    expect(writes.delivery).toBe(0);
  });

  it("does not write a second event on double ready", async () => {
    const { orders, deps } = memoryOps([seed("PREPARING")]);
    const [first, second] = await Promise.all([
      markMerchantOrderReady(
        { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
        deps,
      ),
      markMerchantOrderReady(
        { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
        deps,
      ),
    ]);
    expect(Number(first.ok) + Number(second.ok)).toBe(1);
    expect(orders[0]?.status).toBe("READY");
    expect(orders[0]?.events).toHaveLength(1);
  });

  it("denies ACCEPTED to READY and terminal orders", async () => {
    const accepted = memoryOps([seed("ACCEPTED")]);
    const completed = memoryOps([seed("COMPLETED")]);
    const skipped = await markMerchantOrderReady(
      { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
      accepted.deps,
    );
    const terminal = await markMerchantOrderReady(
      { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
      completed.deps,
    );
    expect(skipped.ok).toBe(false);
    if (!skipped.ok) {
      expect(skipped.error.code).toBe("ORDER_TRANSITION_INVALID");
    }
    expect(terminal.ok).toBe(false);
    if (!terminal.ok) {
      expect(terminal.error.code).toBe("ORDER_TRANSITION_TERMINAL");
    }
    expect(accepted.orders[0]?.status).toBe("ACCEPTED");
    expect(completed.orders[0]?.status).toBe("COMPLETED");
    expect(accepted.orders[0]?.events).toHaveLength(0);
    expect(completed.orders[0]?.events).toHaveLength(0);
  });
});

describe("completeMerchantPickupOrder", () => {
  it("completes READY PICKUP with canCompleteOrder, one event, and zero stock/Delivery writes", async () => {
    const { orders, deps, writes } = memoryOps([pickupReady()]);
    const result = await completeMerchantPickupOrder(
      { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("COMPLETED");
    expect(result.value.previousStatus).toBe("READY");
    expect(orders[0]?.events).toHaveLength(1);
    expect(orders[0]?.events[0]).toMatchObject({
      fromStatus: "READY",
      toStatus: "COMPLETED",
      actorType: "MERCHANT_USER",
      actorId: OWNER_ID,
      reason: null,
    });
    expect(orders[0]?.stockQuantity).toBe(2);
    expect(orders[0]?.deliveryStatus).toBeNull();
    expect(writes.stock).toBe(0);
    expect(writes.delivery).toBe(0);
    expect(
      canCompleteOrder({
        orderStatus: "READY",
        fulfillmentMethod: "PICKUP",
      }).ok,
    ).toBe(true);
  });

  it("denies READY MERCHANT_DELIVERY and PLATFORM_DELIVERY on the pickup path", async () => {
    const merchantDelivery = memoryOps([
      seed("READY", {
        fulfillmentMethod: "MERCHANT_DELIVERY",
        deliveryStatus: "PENDING",
      }),
    ]);
    const platform = memoryOps([
      seed("READY", {
        fulfillmentMethod: "PLATFORM_DELIVERY",
        deliveryStatus: "PENDING",
      }),
    ]);
    const merchantResult = await completeMerchantPickupOrder(
      { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
      merchantDelivery.deps,
    );
    const platformResult = await completeMerchantPickupOrder(
      { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
      platform.deps,
    );
    expect(merchantResult.ok).toBe(false);
    if (!merchantResult.ok) {
      expect(merchantResult.error.code).toBe(
        "ORDER_COMPLETE_WRONG_FULFILLMENT",
      );
      expect(merchantResult.error.message).toBe(
        "Este pedido no se puede completar como retiro.",
      );
    }
    expect(platformResult.ok).toBe(false);
    expect(merchantDelivery.orders[0]?.status).toBe("READY");
    expect(merchantDelivery.orders[0]?.events).toHaveLength(0);
    expect(merchantDelivery.writes.stock).toBe(0);
    expect(merchantDelivery.writes.delivery).toBe(0);
  });

  it("denies PREPARING PICKUP, COMPLETED, and CANCELED", async () => {
    const preparing = memoryOps([
      seed("PREPARING", { fulfillmentMethod: "PICKUP", deliveryStatus: null }),
    ]);
    const completed = memoryOps([
      seed("COMPLETED", { fulfillmentMethod: "PICKUP", deliveryStatus: null }),
    ]);
    const canceled = memoryOps([
      seed("CANCELED", { fulfillmentMethod: "PICKUP", deliveryStatus: null }),
    ]);
    const fromPreparing = await completeMerchantPickupOrder(
      { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
      preparing.deps,
    );
    const fromCompleted = await completeMerchantPickupOrder(
      { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
      completed.deps,
    );
    const fromCanceled = await completeMerchantPickupOrder(
      { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
      canceled.deps,
    );
    expect(fromPreparing.ok).toBe(false);
    if (!fromPreparing.ok) {
      expect(fromPreparing.error.code).toBe("ORDER_COMPLETE_NOT_READY");
    }
    expect(fromCompleted.ok).toBe(false);
    if (!fromCompleted.ok) {
      expect(fromCompleted.error.code).toBe("ORDER_TRANSITION_NOOP");
    }
    expect(fromCanceled.ok).toBe(false);
    if (!fromCanceled.ok) {
      expect(fromCanceled.error.code).toBe("ORDER_TRANSITION_TERMINAL");
    }
    expect(preparing.orders[0]?.events).toHaveLength(0);
    expect(completed.orders[0]?.events).toHaveLength(0);
    expect(canceled.orders[0]?.events).toHaveLength(0);
    expect(preparing.writes.stock).toBe(0);
    expect(completed.writes.stock).toBe(0);
    expect(canceled.writes.stock).toBe(0);
  });

  it("denies merchant B and a nonexistent order", async () => {
    const { orders, deps } = memoryOps([pickupReady()]);
    const foreign = await completeMerchantPickupOrder(
      { merchantId: MERCHANT_B, orderId: ORDER_A, actorUserId: OWNER_ID },
      deps,
    );
    const missing = await completeMerchantPickupOrder(
      { merchantId: MERCHANT_A, orderId: MISSING, actorUserId: OWNER_ID },
      deps,
    );
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) {
      expect(foreign.error.code).toBe("ORDER_NOT_FOUND");
      expect(foreign.error.message).toBe("El pedido no existe.");
    }
    expect(missing.ok).toBe(false);
    expect(orders[0]?.status).toBe("READY");
    expect(orders[0]?.events).toHaveLength(0);
  });

  it("rolls back if the OrderEvent insert fails", async () => {
    const { orders, deps, writes } = memoryOps([pickupReady()], undefined, {
      failOn: "complete-event",
    });
    const result = await completeMerchantPickupOrder(
      { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ORDER_PERSISTENCE_FAILED");
      expect(result.error.message).not.toContain("simulated");
    }
    expect(orders[0]?.status).toBe("READY");
    expect(orders[0]?.events).toHaveLength(0);
    expect(orders[0]?.stockQuantity).toBe(2);
    expect(orders[0]?.deliveryStatus).toBeNull();
    expect(writes.stock).toBe(0);
    expect(writes.delivery).toBe(0);
  });

  it("does not write a second event on double complete", async () => {
    const { orders, deps, writes } = memoryOps([pickupReady()]);
    const [first, second] = await Promise.all([
      completeMerchantPickupOrder(
        { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
        deps,
      ),
      completeMerchantPickupOrder(
        { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
        deps,
      ),
    ]);
    expect(Number(first.ok) + Number(second.ok)).toBe(1);
    const failed = first.ok ? second : first;
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.error.code).toBe("ORDER_TRANSITION_NOOP");
      expect(failed.error.message).toBe("El pedido ya fue procesado.");
    }
    expect(orders[0]?.status).toBe("COMPLETED");
    expect(orders[0]?.events).toHaveLength(1);
    expect(writes.stock).toBe(0);
  });

  it("serializes complete vs cancel on READY PICKUP", async () => {
    const { orders, deps, writes } = memoryOps([pickupReady()]);
    const [completed, canceled] = await Promise.all([
      completeMerchantPickupOrder(
        { merchantId: MERCHANT_A, orderId: ORDER_A, actorUserId: OWNER_ID },
        deps,
      ),
      cancelOrder(
        {
          orderId: ORDER_A,
          actor: { type: "MERCHANT_USER", id: OWNER_ID },
          reason: "OTHER",
          expectedMerchantId: MERCHANT_A,
        },
        {
          now: deps.now,
          cancelOrderInTransaction: deps.cancelOrderInTransaction,
        },
      ),
    ]);
    expect(Number(completed.ok) + Number(canceled.ok)).toBe(1);
    expect(orders[0]?.events).toHaveLength(1);
    if (completed.ok) {
      expect(orders[0]?.status).toBe("COMPLETED");
      expect(orders[0]?.stockQuantity).toBe(2);
      expect(writes.stock).toBe(0);
      expect(canceled.ok).toBe(false);
    } else {
      expect(orders[0]?.status).toBe("CANCELED");
      expect(orders[0]?.stockQuantity).toBe(3);
      expect(writes.stock).toBe(1);
      expect(completed.ok).toBe(false);
    }
  });
});
