import { describe, expect, it } from "vitest";
import { DomainError } from "../shared/errors";
import {
  addMoney,
  assertNonNegativeMoneyCents,
  moneyCents,
  multiplyMoney,
  zeroCents,
} from "./money-cents";

describe("money-cents", () => {
  it("accepts valid non-negative safe integers", () => {
    expect(moneyCents(0)).toBe(0);
    expect(moneyCents(1245050)).toBe(1245050);
  });

  it("rejects floats, NaN, Infinity, and unsafe integers", () => {
    expect(() => assertNonNegativeMoneyCents(12.5)).toThrow(DomainError);
    expect(() => assertNonNegativeMoneyCents(Number.NaN)).toThrow(DomainError);
    expect(() => assertNonNegativeMoneyCents(Number.POSITIVE_INFINITY)).toThrow(
      DomainError,
    );
    expect(() =>
      assertNonNegativeMoneyCents(Number.MAX_SAFE_INTEGER + 1),
    ).toThrow(DomainError);
  });

  it("rejects negatives for prices and totals", () => {
    try {
      assertNonNegativeMoneyCents(-1);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe("MONEY_NEGATIVE");
    }
  });

  it("adds and multiplies without floating point", () => {
    const a = moneyCents(100);
    const b = moneyCents(250);
    expect(addMoney(a, b, zeroCents())).toBe(350);
    expect(multiplyMoney(moneyCents(1250), 4)).toBe(5000);
  });

  it("rejects invalid multiply quantities", () => {
    expect(() => multiplyMoney(moneyCents(100), -1)).toThrow(DomainError);
    expect(() => multiplyMoney(moneyCents(100), 1.5)).toThrow(DomainError);
  });
});
