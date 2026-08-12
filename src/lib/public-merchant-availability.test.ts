import { describe, expect, it } from "vitest";
import {
  getMerchantOperationalStatus,
  isMerchantOperationallyAcceptingOrders,
} from "@/domain/merchant/operational-availability";
import { getPublicMerchantAvailabilityPresentation } from "./public-merchant-availability";

describe("public merchant availability", () => {
  const now = new Date("2026-08-12T15:00:00.000Z");

  it("ACTIVE accepting is Disponible", () => {
    const status = getMerchantOperationalStatus(
      {
        status: "ACTIVE",
        acceptingOrders: true,
        pausedUntil: null,
      },
      now,
    );
    expect(getPublicMerchantAvailabilityPresentation(status).label).toBe(
      "Disponible",
    );
    expect(
      isMerchantOperationallyAcceptingOrders(
        { status: "ACTIVE", acceptingOrders: true, pausedUntil: null },
        now,
      ),
    ).toBe(true);
  });

  it("future paused_until is Pausado temporalmente", () => {
    const status = getMerchantOperationalStatus(
      {
        status: "ACTIVE",
        acceptingOrders: true,
        pausedUntil: new Date("2026-08-12T16:00:00.000Z"),
      },
      now,
    );
    expect(getPublicMerchantAvailabilityPresentation(status).label).toBe(
      "Pausado temporalmente",
    );
  });

  it("past paused_until is Disponible without DB mutation", () => {
    const merchant = {
      status: "ACTIVE" as const,
      acceptingOrders: true,
      pausedUntil: new Date("2026-08-12T14:00:00.000Z"),
    };
    const status = getMerchantOperationalStatus(merchant, now);
    expect(status).toBe("ACCEPTING");
    expect(getPublicMerchantAvailabilityPresentation(status).label).toBe(
      "Disponible",
    );
    expect(merchant.pausedUntil.toISOString()).toBe("2026-08-12T14:00:00.000Z");
  });
});
