import { describe, expect, it } from "vitest";
import { moneyCents } from "../money/money-cents";
import { calculateLineTotal, calculateOrderTotals } from "./totals";

describe("order totals", () => {
  it("calculates a simple product line", () => {
    const totals = calculateOrderTotals([
      {
        unitPriceCents: moneyCents(100000),
        quantity: 1,
        options: [],
      },
    ]);

    expect(totals.itemSubtotalCents).toBe(100000);
    expect(totals.optionsSubtotalCents).toBe(0);
    expect(totals.orderSubtotalCents).toBe(100000);
    expect(totals.deliveryFeeCents).toBe(0);
    expect(totals.totalCents).toBe(100000);
  });

  it("multiplies quantity > 1", () => {
    const totals = calculateOrderTotals([
      {
        unitPriceCents: moneyCents(50000),
        quantity: 3,
        options: [],
      },
    ]);
    expect(totals.itemSubtotalCents).toBe(150000);
    expect(totals.totalCents).toBe(150000);
  });

  it("adds option price deltas", () => {
    const totals = calculateOrderTotals([
      {
        unitPriceCents: moneyCents(100000),
        quantity: 1,
        options: [
          { priceDeltaCents: moneyCents(15000), quantity: 1 },
          { priceDeltaCents: moneyCents(5000), quantity: 1 },
        ],
      },
    ]);

    expect(totals.itemSubtotalCents).toBe(100000);
    expect(totals.optionsSubtotalCents).toBe(20000);
    expect(totals.orderSubtotalCents).toBe(120000);
    expect(totals.totalCents).toBe(120000);
  });

  it("supports QUANTITY option rows and delivery fee", () => {
    const line = {
      unitPriceCents: moneyCents(600000),
      quantity: 1,
      options: [
        { priceDeltaCents: moneyCents(0), quantity: 4 },
        { priceDeltaCents: moneyCents(0), quantity: 3 },
        { priceDeltaCents: moneyCents(5000), quantity: 5 },
      ],
    };

    expect(calculateLineTotal(line)).toBe(625000);

    const totals = calculateOrderTotals([line], moneyCents(25000));
    expect(totals.optionsSubtotalCents).toBe(25000);
    expect(totals.orderSubtotalCents).toBe(625000);
    expect(totals.deliveryFeeCents).toBe(25000);
    expect(totals.totalCents).toBe(650000);
  });

  it("scales per-unit options by line quantity", () => {
    const totals = calculateOrderTotals([
      {
        unitPriceCents: moneyCents(10000),
        quantity: 2,
        options: [{ priceDeltaCents: moneyCents(1000), quantity: 1 }],
      },
    ]);

    expect(totals.itemSubtotalCents).toBe(20000);
    expect(totals.optionsSubtotalCents).toBe(2000);
    expect(totals.totalCents).toBe(22000);
  });
});
