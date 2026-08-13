import { describe, expect, it } from "vitest";
import { buildOrderIntentFingerprint } from "./intent-fingerprint";

describe("buildOrderIntentFingerprint", () => {
  it("is stable for equivalent option order", () => {
    const a = buildOrderIntentFingerprint({
      merchantId: "m1",
      customerNameSnapshot: "Ana",
      customerPhoneSnapshot: "2804123456",
      fulfillmentMethod: "PICKUP",
      paymentMethodCode: "CASH",
      delivery: null,
      lines: [
        {
          productId: "p1",
          quantity: 1,
          options: [
            { optionGroupId: "g1", optionChoiceId: "c2", quantity: 3 },
            { optionGroupId: "g1", optionChoiceId: "c1", quantity: 6 },
          ],
        },
      ],
    });
    const b = buildOrderIntentFingerprint({
      merchantId: "m1",
      customerNameSnapshot: "Ana",
      customerPhoneSnapshot: "2804123456",
      fulfillmentMethod: "PICKUP",
      paymentMethodCode: "CASH",
      delivery: null,
      lines: [
        {
          productId: "p1",
          quantity: 1,
          options: [
            { optionGroupId: "g1", optionChoiceId: "c1", quantity: 6 },
            { optionGroupId: "g1", optionChoiceId: "c2", quantity: 3 },
          ],
        },
      ],
    });
    expect(a).toBe(b);
  });

  it("changes when the payload intent changes", () => {
    const base = {
      merchantId: "m1",
      customerNameSnapshot: "Ana",
      customerPhoneSnapshot: "2804123456",
      fulfillmentMethod: "PICKUP" as const,
      paymentMethodCode: "CASH",
      delivery: null,
      lines: [{ productId: "p1", quantity: 1, options: [] }],
    };
    expect(buildOrderIntentFingerprint(base)).not.toBe(
      buildOrderIntentFingerprint({ ...base, paymentMethodCode: "TRANSFER" }),
    );
  });
});
