import { describe, expect, it } from "vitest";
import { moneyCents } from "@/domain/money/money-cents";
import { DomainError } from "@/domain/shared/errors";
import { moneyCentsFromPg, moneyCentsToPg } from "./money-mapping";

describe("money pg mapping", () => {
  it("round-trips safe integer cents via string driver form", () => {
    const amount = moneyCents(125050);
    expect(moneyCentsToPg(amount)).toBe("125050");
    expect(moneyCentsFromPg("125050")).toBe(125050);
    expect(moneyCentsFromPg(125050)).toBe(125050);
    expect(moneyCentsFromPg(BigInt(125050))).toBe(125050);
  });

  it("rejects negative and non-integer inputs on write via assert", () => {
    expect(() => moneyCentsToPg(-1 as never)).toThrow(DomainError);
  });

  it("rejects bigint beyond Number.MAX_SAFE_INTEGER without silent Number cast", () => {
    const tooLarge = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1);
    try {
      moneyCentsFromPg(tooLarge);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe("MONEY_OVERFLOW");
    }

    try {
      moneyCentsFromPg(String(tooLarge));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe("MONEY_OVERFLOW");
    }
  });

  it("accepts Number.MAX_SAFE_INTEGER boundary", () => {
    expect(moneyCentsFromPg(BigInt(Number.MAX_SAFE_INTEGER))).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it("never uses floating-point representation", () => {
    const serialized = moneyCentsToPg(moneyCents(199));
    expect(serialized.includes(".")).toBe(false);
    expect(Number.isInteger(moneyCentsFromPg(serialized))).toBe(true);
  });
});
