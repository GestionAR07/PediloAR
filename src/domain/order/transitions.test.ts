import { describe, expect, it } from "vitest";
import {
  assertFulfillmentAllowedForMvp,
  canTransitionOrderStatus,
  isOrderTerminalStatus,
  transitionOrderStatus,
} from "./transitions";
import type { OrderStatus } from "./enums";

const VALID: Array<[OrderStatus, OrderStatus]> = [
  ["PENDING", "ACCEPTED"],
  ["PENDING", "CANCELED"],
  ["ACCEPTED", "PREPARING"],
  ["ACCEPTED", "CANCELED"],
  ["PREPARING", "READY"],
  ["PREPARING", "CANCELED"],
  ["READY", "COMPLETED"],
  ["READY", "CANCELED"],
];

const INVALID: Array<[OrderStatus, OrderStatus]> = [
  ["PENDING", "READY"],
  ["PENDING", "COMPLETED"],
  ["PENDING", "PREPARING"],
  ["ACCEPTED", "COMPLETED"],
  ["ACCEPTED", "READY"],
  ["PREPARING", "COMPLETED"],
  ["PREPARING", "ACCEPTED"],
  ["COMPLETED", "PENDING"],
  ["COMPLETED", "CANCELED"],
  ["CANCELED", "ACCEPTED"],
  ["CANCELED", "PENDING"],
  ["READY", "PREPARING"],
];

describe("order state machine", () => {
  it("allows every approved transition", () => {
    for (const [from, to] of VALID) {
      expect(canTransitionOrderStatus(from, to)).toBe(true);
      const result = transitionOrderStatus(from, to);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(to);
      }
    }
  });

  it("rejects invalid and terminal escapes", () => {
    for (const [from, to] of INVALID) {
      expect(canTransitionOrderStatus(from, to)).toBe(false);
      const result = transitionOrderStatus(from, to);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toMatch(/^ORDER_TRANSITION_/);
      }
    }
  });

  it("marks COMPLETED and CANCELED as terminal", () => {
    expect(isOrderTerminalStatus("COMPLETED")).toBe(true);
    expect(isOrderTerminalStatus("CANCELED")).toBe(true);
    expect(isOrderTerminalStatus("READY")).toBe(false);
  });

  it("rejects no-op transitions", () => {
    const result = transitionOrderStatus("PENDING", "PENDING");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ORDER_TRANSITION_NOOP");
    }
  });

  it("disables PLATFORM_DELIVERY for MVP", () => {
    expect(assertFulfillmentAllowedForMvp("PICKUP").ok).toBe(true);
    expect(assertFulfillmentAllowedForMvp("MERCHANT_DELIVERY").ok).toBe(true);
    const platform = assertFulfillmentAllowedForMvp("PLATFORM_DELIVERY");
    expect(platform.ok).toBe(false);
    if (!platform.ok) {
      expect(platform.error.code).toBe("FULFILLMENT_PLATFORM_DISABLED");
    }
  });
});
