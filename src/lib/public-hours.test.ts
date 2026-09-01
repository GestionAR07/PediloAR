import { describe, expect, it } from "vitest";
import type { MerchantOpeningInterval } from "@/domain/merchant/types";
import {
  getMerchantHoursOpenState,
  getPublicHoursPresentation,
} from "./public-hours";

const CITY_TIMEZONE = "America/Argentina/Catamarca";
const NOW = new Date("2026-08-13T12:00:00.000Z");

function thursdayHours(
  openMinute: number,
  closeMinute: number,
): MerchantOpeningInterval {
  return {
    merchantId: "m1",
    weekday: 4,
    openMinute,
    closeMinute,
  };
}

describe("merchant hours open state", () => {
  it("is unknown when no intervals are configured", () => {
    expect(
      getMerchantHoursOpenState({
        intervals: [],
        timezone: CITY_TIMEZONE,
        now: NOW,
      }),
    ).toBe("unknown");
    expect(
      getPublicHoursPresentation({
        intervals: [],
        timezone: CITY_TIMEZONE,
        now: NOW,
      }),
    ).toBeNull();
  });

  it("is unknown when timezone conversion fails", () => {
    expect(
      getMerchantHoursOpenState({
        intervals: [thursdayHours(9 * 60, 18 * 60)],
        timezone: "Not/AZone",
        now: NOW,
      }),
    ).toBe("unknown");
  });

  it("is open inside the local interval and closed outside", () => {
    const intervals = [thursdayHours(9 * 60, 18 * 60)];
    expect(
      getMerchantHoursOpenState({
        intervals,
        timezone: CITY_TIMEZONE,
        now: NOW,
      }),
    ).toBe("open");
    expect(
      getPublicHoursPresentation({
        intervals,
        timezone: CITY_TIMEZONE,
        now: NOW,
      })?.label,
    ).toBe("Abierto");

    const closedIntervals = [thursdayHours(17 * 60, 21 * 60)];
    expect(
      getMerchantHoursOpenState({
        intervals: closedIntervals,
        timezone: CITY_TIMEZONE,
        now: NOW,
      }),
    ).toBe("closed");
    expect(
      getPublicHoursPresentation({
        intervals: closedIntervals,
        timezone: CITY_TIMEZONE,
        now: NOW,
      })?.label,
    ).toBe("Cerrado");
  });

  it("uses the merchant IANA timezone rather than UTC", () => {
    const intervals = [thursdayHours(9 * 60, 18 * 60)];
    expect(
      getMerchantHoursOpenState({
        intervals,
        timezone: CITY_TIMEZONE,
        now: NOW,
      }),
    ).toBe("open");
    expect(
      getMerchantHoursOpenState({
        intervals,
        timezone: "America/Los_Angeles",
        now: NOW,
      }),
    ).toBe("closed");
  });
});
