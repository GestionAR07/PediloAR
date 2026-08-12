import { describe, expect, it } from "vitest";
import { moneyCents } from "@/domain/money/money-cents";
import { formatMoneyCentsArs } from "./format-money";
import { formatOptionChoiceLine } from "./format-option-choice";

describe("formatOptionChoiceLine", () => {
  it("formats zero delta", () => {
    expect(
      formatOptionChoiceLine("475cc", 0, (cents) =>
        formatMoneyCentsArs(moneyCents(cents)),
      ),
    ).toBe("475cc — $0,00");
  });

  it("formats positive delta with plus sign", () => {
    expect(
      formatOptionChoiceLine("1,5L", 150000, (cents) =>
        formatMoneyCentsArs(moneyCents(cents)),
      ),
    ).toBe("1,5L — +1.500,00");
  });
});
