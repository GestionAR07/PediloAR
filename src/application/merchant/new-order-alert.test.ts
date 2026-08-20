import { afterEach, describe, expect, it } from "vitest";
import {
  applyMerchantNewOrderInsert,
  dismissMerchantNewOrderToast,
  merchantOrderDetailHref,
  recordSessionMerchantNewOrderInsert,
  resetMerchantNewOrderAlertForTests,
  SEEN_NEW_ORDER_ID_CAP,
} from "./new-order-alert";

const ORDER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORDER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORDER_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ORDER_D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const MERCHANT = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  resetMerchantNewOrderAlertForTests();
});

describe("merchantOrderDetailHref", () => {
  it("points at the merchant order detail route", () => {
    expect(merchantOrderDetailHref(MERCHANT, ORDER_A)).toBe(
      `/merchant/${MERCHANT}/orders/${ORDER_A}`,
    );
  });
});

describe("applyMerchantNewOrderInsert", () => {
  it("keeps distinct order ids as distinct toasts", () => {
    const seen = new Set<string>();
    const first = applyMerchantNewOrderInsert({
      seenOrderIds: seen,
      visibleOrderIds: [],
      lastFullChimeAtMs: null,
      soundEnabled: true,
      orderId: ORDER_A,
      nowMs: 1_000,
    });
    const second = applyMerchantNewOrderInsert({
      seenOrderIds: seen,
      visibleOrderIds: first.visibleOrderIds,
      lastFullChimeAtMs: first.lastFullChimeAtMs,
      soundEnabled: true,
      orderId: ORDER_B,
      nowMs: 1_200,
    });

    expect(first.isDuplicate).toBe(false);
    expect(second.isDuplicate).toBe(false);
    expect(second.visibleOrderIds).toEqual([ORDER_A, ORDER_B]);
  });

  it("does not enqueue a second toast for the same order id", () => {
    const seen = new Set<string>();
    const first = applyMerchantNewOrderInsert({
      seenOrderIds: seen,
      visibleOrderIds: [],
      lastFullChimeAtMs: null,
      soundEnabled: true,
      orderId: ORDER_A,
      nowMs: 1_000,
    });
    const second = applyMerchantNewOrderInsert({
      seenOrderIds: seen,
      visibleOrderIds: first.visibleOrderIds,
      lastFullChimeAtMs: first.lastFullChimeAtMs,
      soundEnabled: true,
      orderId: ORDER_A,
      nowMs: 1_100,
    });

    expect(second.isDuplicate).toBe(true);
    expect(second.visibleOrderIds).toEqual([ORDER_A]);
    expect(second.chime).toBe("none");
  });

  it("does not chime when sound is off", () => {
    const result = applyMerchantNewOrderInsert({
      seenOrderIds: new Set(),
      visibleOrderIds: [],
      lastFullChimeAtMs: null,
      soundEnabled: false,
      orderId: ORDER_A,
      nowMs: 1_000,
    });
    expect(result.chime).toBe("none");
    expect(result.visibleOrderIds).toEqual([ORDER_A]);
  });

  it("plays a full chime then a short chime inside the cooldown window", () => {
    const seen = new Set<string>();
    const first = applyMerchantNewOrderInsert({
      seenOrderIds: seen,
      visibleOrderIds: [],
      lastFullChimeAtMs: null,
      soundEnabled: true,
      orderId: ORDER_A,
      nowMs: 1_000,
      chimeCooldownMs: 2_500,
    });
    const second = applyMerchantNewOrderInsert({
      seenOrderIds: seen,
      visibleOrderIds: first.visibleOrderIds,
      lastFullChimeAtMs: first.lastFullChimeAtMs,
      soundEnabled: true,
      orderId: ORDER_B,
      nowMs: 2_000,
      chimeCooldownMs: 2_500,
    });
    const third = applyMerchantNewOrderInsert({
      seenOrderIds: seen,
      visibleOrderIds: second.visibleOrderIds,
      lastFullChimeAtMs: second.lastFullChimeAtMs,
      soundEnabled: true,
      orderId: ORDER_C,
      nowMs: 4_000,
      chimeCooldownMs: 2_500,
    });

    expect(first.chime).toBe("full");
    expect(second.chime).toBe("soft");
    expect(third.chime).toBe("full");
  });

  it("drops the oldest visible toast when a fourth distinct order arrives", () => {
    const seen = new Set<string>();
    let visible: string[] = [];
    let lastFullChimeAtMs: number | null = null;
    for (const [index, orderId] of [
      ORDER_A,
      ORDER_B,
      ORDER_C,
      ORDER_D,
    ].entries()) {
      const result = applyMerchantNewOrderInsert({
        seenOrderIds: seen,
        visibleOrderIds: visible,
        lastFullChimeAtMs,
        soundEnabled: false,
        orderId,
        nowMs: index,
      });
      visible = result.visibleOrderIds;
      lastFullChimeAtMs = result.lastFullChimeAtMs;
    }
    expect(visible).toEqual([ORDER_B, ORDER_C, ORDER_D]);
  });

  it("evicts the oldest seen id after the cap so memory stays bounded", () => {
    const seen = new Set<string>();
    for (let i = 0; i < SEEN_NEW_ORDER_ID_CAP; i += 1) {
      applyMerchantNewOrderInsert({
        seenOrderIds: seen,
        visibleOrderIds: [],
        lastFullChimeAtMs: null,
        soundEnabled: false,
        orderId: `order-${i}`,
        nowMs: i,
        seenCap: SEEN_NEW_ORDER_ID_CAP,
      });
    }
    expect(seen.size).toBe(SEEN_NEW_ORDER_ID_CAP);
    applyMerchantNewOrderInsert({
      seenOrderIds: seen,
      visibleOrderIds: [],
      lastFullChimeAtMs: null,
      soundEnabled: false,
      orderId: "order-new",
      nowMs: 99,
      seenCap: SEEN_NEW_ORDER_ID_CAP,
    });
    expect(seen.has("order-0")).toBe(false);
    expect(seen.has("order-new")).toBe(true);
    expect(seen.size).toBe(SEEN_NEW_ORDER_ID_CAP);
  });
});

describe("dismissMerchantNewOrderToast", () => {
  it("removes only the dismissed order id", () => {
    expect(
      dismissMerchantNewOrderToast([ORDER_A, ORDER_B, ORDER_C], ORDER_B),
    ).toEqual([ORDER_A, ORDER_C]);
  });
});

describe("recordSessionMerchantNewOrderInsert", () => {
  it("dedupes across calls using the session set", () => {
    const first = recordSessionMerchantNewOrderInsert({
      visibleOrderIds: [],
      soundEnabled: true,
      orderId: ORDER_A,
      nowMs: 1,
    });
    const second = recordSessionMerchantNewOrderInsert({
      visibleOrderIds: first.visibleOrderIds,
      soundEnabled: true,
      orderId: ORDER_A,
      nowMs: 2,
    });
    expect(first.isDuplicate).toBe(false);
    expect(second.isDuplicate).toBe(true);
    expect(second.chime).toBe("none");
  });

  it("does not start order-chime cooldown from a manual test sound", () => {
    const result = recordSessionMerchantNewOrderInsert({
      visibleOrderIds: [],
      soundEnabled: true,
      orderId: ORDER_A,
      nowMs: 1,
    });
    expect(result.chime).toBe("full");
    expect(result.lastFullChimeAtMs).toBe(1);
  });
});
