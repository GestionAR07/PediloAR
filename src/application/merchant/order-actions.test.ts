import { describe, expect, it, vi } from "vitest";
import { AuthzError } from "@/server/auth/errors";
import { CHECKOUT_ERROR_CODES } from "@/application/checkout/errors";
import type {
  CancelOrderCommand,
  CancelOrderPersistResult,
} from "@/application/checkout/types";
import { canCancelOrder } from "@/domain/order/cancellation";
import type { DeliveryStatus } from "@/domain/delivery/enums";
import type { OrderStatus } from "@/domain/order/enums";
import { transitionOrderStatus } from "@/domain/order/transitions";
import {
  acceptMerchantOrder,
  isMerchantRejectReason,
  MERCHANT_REJECT_REASONS,
  rejectMerchantOrder,
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
): { orders: StoredOrder[]; deps: MerchantOrderActionDeps } {
  const lock = new SerialLock();

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
      if (stored.deliveryStatus && stored.deliveryStatus !== "DELIVERED") {
        stored.deliveryStatus = "CANCELED";
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

  return {
    orders,
    deps: {
      now: () => NOW,
      requireMerchantOrderAccess: access,
      transitionMerchantOrderInTransaction,
      cancelOrderInTransaction,
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
