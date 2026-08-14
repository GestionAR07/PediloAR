import { describe, expect, it } from "vitest";
import {
  MERCHANT_ORDER_TRANSITION_ERROR_CODES,
  MERCHANT_OPERATIONAL_TARGETS,
  assertMerchantOperationalTarget,
  decideMerchantOperationalTransition,
  parseLockedOrderStatus,
  transitionMerchantOperationalOrder,
  type MerchantOrderTransitionDeps,
  type MerchantOrderTransitionPersistResult,
  type TransitionMerchantOrderCommand,
} from "./order-transitions";

const MERCHANT_A = "11111111-1111-4111-8111-111111111111";
const MERCHANT_B = "22222222-2222-4222-8222-222222222222";
const ORDER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MISSING_ORDER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ACTOR = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NOW = new Date("2026-08-14T14:00:00.000Z");

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

function memoryPersist(
  orders: StoredOrder[],
  options: { failOn?: "update" | "event" } = {},
): {
  orders: StoredOrder[];
  deps: MerchantOrderTransitionDeps;
} {
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
            code: MERCHANT_ORDER_TRANSITION_ERROR_CODES.ORDER_NOT_FOUND,
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
        const targetGuard = assertMerchantOperationalTarget(
          command.targetStatus,
        );
        if (!targetGuard.ok) {
          return { status: "rejected", error: targetGuard.error };
        }
        const current = parseLockedOrderStatus(stored.status);
        if (!current.ok) {
          return { status: "rejected", error: current.error };
        }
        const next = decideMerchantOperationalTransition(
          current.value,
          targetGuard.value,
        );
        if (!next.ok) {
          return { status: "rejected", error: next.error };
        }

        if (options.failOn === "update") {
          throw new Error("simulated order update failure");
        }
        stored.status = next.value;

        if (options.failOn === "event") {
          throw new Error("simulated order_events insert failure");
        }
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
      } catch {
        stored.status = snapshot.status;
        stored.stockQuantity = snapshot.stockQuantity;
        stored.deliveryStatus = snapshot.deliveryStatus;
        stored.events.splice(0, stored.events.length, ...snapshot.events);
        return {
          status: "rejected",
          error: {
            code: MERCHANT_ORDER_TRANSITION_ERROR_CODES.ORDER_PERSISTENCE_FAILED,
            message: "No se pudo actualizar el pedido.",
          },
        };
      }
    });
  }

  return {
    orders,
    deps: {
      now: () => NOW,
      transitionMerchantOrderInTransaction,
    },
  };
}

function seed(
  status: string,
  overrides: Partial<StoredOrder> = {},
): StoredOrder {
  return {
    merchantId: MERCHANT_A,
    id: ORDER_A,
    status,
    stockQuantity: 2,
    deliveryStatus: "PENDING",
    events: [],
    ...overrides,
  };
}

async function advance(
  deps: MerchantOrderTransitionDeps,
  targetStatus: string,
  extra: Partial<{ merchantId: string; orderId: string }> = {},
) {
  return transitionMerchantOperationalOrder(
    {
      merchantId: extra.merchantId ?? MERCHANT_A,
      orderId: extra.orderId ?? ORDER_A,
      actorUserId: ACTOR,
      targetStatus,
    },
    deps,
  );
}

describe("merchant operational transition core", () => {
  it("advances PENDING -> ACCEPTED with exactly one MERCHANT_USER event", async () => {
    const { orders, deps } = memoryPersist([seed("PENDING")]);
    const result = await advance(deps, "ACCEPTED");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      orderId: ORDER_A,
      previousStatus: "PENDING",
      status: "ACCEPTED",
    });
    expect(orders[0]?.status).toBe("ACCEPTED");
    expect(orders[0]?.events).toHaveLength(1);
    expect(orders[0]?.events[0]).toEqual({
      fromStatus: "PENDING",
      toStatus: "ACCEPTED",
      actorType: "MERCHANT_USER",
      actorId: ACTOR,
      reason: null,
    });
  });

  it("advances ACCEPTED -> PREPARING with exactly one event", async () => {
    const { orders, deps } = memoryPersist([seed("ACCEPTED")]);
    const result = await advance(deps, "PREPARING");
    expect(result.ok).toBe(true);
    expect(orders[0]?.status).toBe("PREPARING");
    expect(orders[0]?.events).toHaveLength(1);
    expect(orders[0]?.events[0]?.toStatus).toBe("PREPARING");
  });

  it("advances PREPARING -> READY with exactly one event", async () => {
    const { orders, deps } = memoryPersist([seed("PREPARING")]);
    const result = await advance(deps, "READY");
    expect(result.ok).toBe(true);
    expect(orders[0]?.status).toBe("READY");
    expect(orders[0]?.events).toHaveLength(1);
    expect(orders[0]?.events[0]?.actorId).toBe(ACTOR);
    expect(orders[0]?.deliveryStatus).toBe("PENDING");
    expect(orders[0]?.stockQuantity).toBe(2);
  });

  it("denies a foreign merchant without leaking the order", async () => {
    const { orders, deps } = memoryPersist([seed("PENDING")]);
    const result = await advance(deps, "ACCEPTED", { merchantId: MERCHANT_B });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ORDER_NOT_FOUND");
      expect(result.error.message).toBe("El pedido no existe.");
    }
    expect(orders[0]?.status).toBe("PENDING");
    expect(orders[0]?.events).toHaveLength(0);
  });

  it("denies a nonexistent order", async () => {
    const { deps } = memoryPersist([seed("PENDING")]);
    const result = await advance(deps, "ACCEPTED", { orderId: MISSING_ORDER });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ORDER_NOT_FOUND");
      expect(result.error.message).toBe("El pedido no existe.");
    }
  });

  it("rejects PENDING -> READY as invalid without writes", async () => {
    const { orders, deps } = memoryPersist([seed("PENDING")]);
    const result = await advance(deps, "READY");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ORDER_TRANSITION_INVALID");
    }
    expect(orders[0]?.status).toBe("PENDING");
    expect(orders[0]?.events).toHaveLength(0);
  });

  it("treats ACCEPTED -> ACCEPTED as no-op without event", async () => {
    const { orders, deps } = memoryPersist([seed("ACCEPTED")]);
    const result = await advance(deps, "ACCEPTED");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ORDER_TRANSITION_NOOP");
    }
    expect(orders[0]?.status).toBe("ACCEPTED");
    expect(orders[0]?.events).toHaveLength(0);
  });

  it("rejects READY -> PREPARING without writes", async () => {
    const { orders, deps } = memoryPersist([seed("READY")]);
    const result = await advance(deps, "PREPARING");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ORDER_TRANSITION_INVALID");
    }
    expect(orders[0]?.status).toBe("READY");
    expect(orders[0]?.events).toHaveLength(0);
  });

  it("keeps COMPLETED immutable", async () => {
    const { orders, deps } = memoryPersist([seed("COMPLETED")]);
    const result = await advance(deps, "ACCEPTED");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ORDER_TRANSITION_TERMINAL");
    }
    expect(orders[0]?.status).toBe("COMPLETED");
    expect(orders[0]?.events).toHaveLength(0);
  });

  it("keeps CANCELED immutable", async () => {
    const { orders, deps } = memoryPersist([seed("CANCELED")]);
    const result = await advance(deps, "ACCEPTED");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ORDER_TRANSITION_TERMINAL");
    }
    expect(orders[0]?.status).toBe("CANCELED");
    expect(orders[0]?.events).toHaveLength(0);
  });

  it("cannot cancel through the generic merchant transition", async () => {
    const persist = memoryPersist([seed("PENDING")]);
    persist.deps.transitionMerchantOrderInTransaction = async () => {
      throw new Error("persist must not run for cancel bypass");
    };
    const result = await advance(persist.deps, "CANCELED");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ORDER_TRANSITION_CANCEL_FORBIDDEN");
    }
    expect(assertMerchantOperationalTarget("CANCELED").ok).toBe(false);
  });

  it("cannot complete through the generic merchant transition", async () => {
    const persist = memoryPersist([seed("READY")]);
    persist.deps.transitionMerchantOrderInTransaction = async () => {
      throw new Error("persist must not run for complete bypass");
    };
    const result = await advance(persist.deps, "COMPLETED");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ORDER_TRANSITION_COMPLETE_FORBIDDEN");
    }
    expect(assertMerchantOperationalTarget("COMPLETED").ok).toBe(false);
  });

  it("does not write stock or Delivery", async () => {
    const { orders, deps } = memoryPersist([
      seed("PENDING", { stockQuantity: 2, deliveryStatus: "PENDING" }),
    ]);
    const result = await advance(deps, "ACCEPTED");
    expect(result.ok).toBe(true);
    expect(orders[0]?.stockQuantity).toBe(2);
    expect(orders[0]?.deliveryStatus).toBe("PENDING");
  });

  it("rolls back if the Order update fails", async () => {
    const { orders, deps } = memoryPersist([seed("PENDING")], {
      failOn: "update",
    });
    const result = await advance(deps, "ACCEPTED");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ORDER_PERSISTENCE_FAILED");
      expect(result.error.message).not.toContain("simulated");
    }
    expect(orders[0]?.status).toBe("PENDING");
    expect(orders[0]?.events).toHaveLength(0);
  });

  it("rolls back if the OrderEvent insert fails", async () => {
    const { orders, deps } = memoryPersist([seed("PENDING")], {
      failOn: "event",
    });
    const result = await advance(deps, "ACCEPTED");
    expect(result.ok).toBe(false);
    expect(orders[0]?.status).toBe("PENDING");
    expect(orders[0]?.events).toHaveLength(0);
    expect(orders[0]?.stockQuantity).toBe(2);
  });

  it("serializes concurrent PENDING -> ACCEPTED to one event", async () => {
    const { orders, deps } = memoryPersist([seed("PENDING")]);
    const [first, second] = await Promise.all([
      advance(deps, "ACCEPTED"),
      advance(deps, "ACCEPTED"),
    ]);
    const outcomes = [first, second];
    expect(outcomes.filter((row) => row.ok)).toHaveLength(1);
    expect(outcomes.filter((row) => !row.ok)).toHaveLength(1);
    const failed = outcomes.find((row) => !row.ok);
    if (failed && !failed.ok) {
      expect(failed.error.code).toBe("ORDER_TRANSITION_NOOP");
    }
    expect(orders[0]?.status).toBe("ACCEPTED");
    expect(orders[0]?.events).toHaveLength(1);
  });

  it("restricts operational targets to ACCEPTED PREPARING READY", () => {
    expect([...MERCHANT_OPERATIONAL_TARGETS]).toEqual([
      "ACCEPTED",
      "PREPARING",
      "READY",
    ]);
    expect(assertMerchantOperationalTarget("ACCEPTED").ok).toBe(true);
    expect(assertMerchantOperationalTarget("PENDING").ok).toBe(false);
  });
});
