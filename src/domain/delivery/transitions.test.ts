import { describe, expect, it } from "vitest";
import {
  canTransitionDeliveryStatus,
  isDeliveryTerminalStatus,
  transitionDeliveryStatus,
} from "./transitions";
import type { DeliveryStatus } from "./enums";

describe("delivery state machine — MERCHANT", () => {
  const valid: Array<[DeliveryStatus, DeliveryStatus]> = [
    ["PENDING", "IN_TRANSIT"],
    ["PENDING", "FAILED"],
    ["PENDING", "CANCELED"],
    ["IN_TRANSIT", "DELIVERED"],
    ["IN_TRANSIT", "FAILED"],
    ["IN_TRANSIT", "CANCELED"],
  ];

  it("allows MVP merchant logistics transitions", () => {
    for (const [from, to] of valid) {
      expect(canTransitionDeliveryStatus("MERCHANT", from, to)).toBe(true);
      expect(transitionDeliveryStatus("MERCHANT", from, to).ok).toBe(true);
    }
  });

  it("rejects courier-style steps for MERCHANT", () => {
    const invalid: Array<[DeliveryStatus, DeliveryStatus]> = [
      ["PENDING", "REQUESTED"],
      ["PENDING", "ASSIGNED"],
      ["PENDING", "PICKED_UP"],
      ["PENDING", "DELIVERED"],
      ["IN_TRANSIT", "PICKED_UP"],
      ["DELIVERED", "IN_TRANSIT"],
    ];

    for (const [from, to] of invalid) {
      expect(canTransitionDeliveryStatus("MERCHANT", from, to)).toBe(false);
      expect(transitionDeliveryStatus("MERCHANT", from, to).ok).toBe(false);
    }
  });
});

describe("delivery state machine — PLATFORM", () => {
  const happyPath: DeliveryStatus[] = [
    "PENDING",
    "REQUESTED",
    "ASSIGNED",
    "PICKED_UP",
    "IN_TRANSIT",
    "DELIVERED",
  ];

  it("allows the conceptual platform happy path", () => {
    for (let i = 0; i < happyPath.length - 1; i += 1) {
      const from = happyPath[i]!;
      const to = happyPath[i + 1]!;
      expect(canTransitionDeliveryStatus("PLATFORM", from, to)).toBe(true);
      expect(transitionDeliveryStatus("PLATFORM", from, to).ok).toBe(true);
    }
  });

  it("allows FAILED/CANCELED from non-terminal platform states", () => {
    const nonTerminal: DeliveryStatus[] = [
      "PENDING",
      "REQUESTED",
      "ASSIGNED",
      "PICKED_UP",
      "IN_TRANSIT",
    ];

    for (const from of nonTerminal) {
      expect(canTransitionDeliveryStatus("PLATFORM", from, "FAILED")).toBe(
        true,
      );
      expect(canTransitionDeliveryStatus("PLATFORM", from, "CANCELED")).toBe(
        true,
      );
    }
  });

  it("rejects skipping platform steps", () => {
    expect(canTransitionDeliveryStatus("PLATFORM", "PENDING", "ASSIGNED")).toBe(
      false,
    );
    expect(
      canTransitionDeliveryStatus("PLATFORM", "REQUESTED", "PICKED_UP"),
    ).toBe(false);
    expect(
      transitionDeliveryStatus("PLATFORM", "PENDING", "DELIVERED").ok,
    ).toBe(false);
  });
});

describe("delivery terminals", () => {
  it("treats DELIVERED, FAILED, CANCELED as terminal", () => {
    expect(isDeliveryTerminalStatus("DELIVERED")).toBe(true);
    expect(isDeliveryTerminalStatus("FAILED")).toBe(true);
    expect(isDeliveryTerminalStatus("CANCELED")).toBe(true);
    expect(isDeliveryTerminalStatus("IN_TRANSIT")).toBe(false);
  });
});
