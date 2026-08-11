import { describe, expect, it } from "vitest";
import { assertOpeningInterval, isOpenAtLocalMinute } from "./hours";
import { DomainError } from "../shared/errors";

describe("merchant hours", () => {
  it("supports split weekday intervals", () => {
    const intervals = [
      {
        merchantId: "m1",
        weekday: 1 as const,
        openMinute: 9 * 60,
        closeMinute: 13 * 60,
      },
      {
        merchantId: "m1",
        weekday: 1 as const,
        openMinute: 17 * 60,
        closeMinute: 21 * 60,
      },
    ];

    for (const interval of intervals) {
      expect(() => assertOpeningInterval(interval)).not.toThrow();
    }

    expect(isOpenAtLocalMinute(intervals, 1, 10 * 60)).toBe(true);
    expect(isOpenAtLocalMinute(intervals, 1, 14 * 60)).toBe(false);
    expect(isOpenAtLocalMinute(intervals, 1, 18 * 60)).toBe(true);
    expect(isOpenAtLocalMinute(intervals, 2, 10 * 60)).toBe(false);
  });

  it("rejects inverted intervals", () => {
    expect(() =>
      assertOpeningInterval({
        weekday: 1,
        openMinute: 13 * 60,
        closeMinute: 9 * 60,
      }),
    ).toThrow(DomainError);
  });
});
