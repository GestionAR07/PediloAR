import { describe, expect, it } from "vitest";
import {
  getMerchantOperationalStatus,
  isMerchantOperationallyAcceptingOrders,
} from "./operational-availability";

const now = new Date("2026-08-12T14:00:00.000Z");
const future = new Date("2026-08-12T15:00:00.000Z");
const past = new Date("2026-08-12T13:00:00.000Z");

describe("isMerchantOperationallyAcceptingOrders", () => {
  it("accepts ACTIVE + acceptingOrders + no pause", () => {
    expect(
      isMerchantOperationallyAcceptingOrders(
        { status: "ACTIVE", acceptingOrders: true, pausedUntil: null },
        now,
      ),
    ).toBe(true);
  });

  it("rejects ACTIVE with future pausedUntil", () => {
    expect(
      isMerchantOperationallyAcceptingOrders(
        { status: "ACTIVE", acceptingOrders: true, pausedUntil: future },
        now,
      ),
    ).toBe(false);
  });

  it("accepts ACTIVE when pausedUntil expired", () => {
    expect(
      isMerchantOperationallyAcceptingOrders(
        { status: "ACTIVE", acceptingOrders: true, pausedUntil: past },
        now,
      ),
    ).toBe(true);
  });

  it("rejects ACTIVE with manual pause", () => {
    expect(
      isMerchantOperationallyAcceptingOrders(
        { status: "ACTIVE", acceptingOrders: false, pausedUntil: null },
        now,
      ),
    ).toBe(false);
  });

  it("rejects DRAFT even when acceptingOrders is true", () => {
    expect(
      isMerchantOperationallyAcceptingOrders(
        { status: "DRAFT", acceptingOrders: true, pausedUntil: null },
        now,
      ),
    ).toBe(false);
  });

  it("rejects SUSPENDED even when acceptingOrders is true", () => {
    expect(
      isMerchantOperationallyAcceptingOrders(
        { status: "SUSPENDED", acceptingOrders: true, pausedUntil: null },
        now,
      ),
    ).toBe(false);
  });
});

describe("getMerchantOperationalStatus", () => {
  it("maps operational states", () => {
    expect(
      getMerchantOperationalStatus(
        { status: "ACTIVE", acceptingOrders: true, pausedUntil: null },
        now,
      ),
    ).toBe("ACCEPTING");

    expect(
      getMerchantOperationalStatus(
        { status: "ACTIVE", acceptingOrders: true, pausedUntil: future },
        now,
      ),
    ).toBe("TEMPORARILY_PAUSED");

    expect(
      getMerchantOperationalStatus(
        { status: "ACTIVE", acceptingOrders: false, pausedUntil: null },
        now,
      ),
    ).toBe("MANUALLY_PAUSED");

    expect(
      getMerchantOperationalStatus(
        { status: "DRAFT", acceptingOrders: true, pausedUntil: null },
        now,
      ),
    ).toBe("NOT_ACTIVE");
  });
});
