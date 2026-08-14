import { describe, expect, it } from "vitest";
import {
  formatInstantAsLocalTime,
  formatMerchantOrderWhen,
  startOfLocalDay,
} from "./format-local-time";

const RAWSON_TZ = "America/Argentina/Catamarca";

describe("startOfLocalDay", () => {
  it("uses the merchant city timezone instead of UTC midnight", () => {
    const now = new Date("2026-08-14T13:18:18.509Z");
    const start = startOfLocalDay(now, RAWSON_TZ);
    expect(start.toISOString()).toBe("2026-08-14T03:00:00.000Z");
    expect(formatInstantAsLocalTime(start, RAWSON_TZ)).toBe("00:00");
  });
});

describe("formatMerchantOrderWhen", () => {
  const now = new Date("2026-08-14T13:18:18.509Z");

  it("shows relative minutes under one hour", () => {
    const createdAt = new Date("2026-08-14T13:13:18.509Z");
    expect(formatMerchantOrderWhen(createdAt, now, RAWSON_TZ)).toEqual({
      ageLabel: "Hace 5 min",
      clockLabel: "10:13",
    });
  });

  it("falls back to local clock after one hour", () => {
    const createdAt = new Date("2026-08-14T11:18:18.509Z");
    const formatted = formatMerchantOrderWhen(createdAt, now, RAWSON_TZ);
    expect(formatted.ageLabel).toBe("08:18");
    expect(formatted.clockLabel).toBe("08:18");
  });
});
