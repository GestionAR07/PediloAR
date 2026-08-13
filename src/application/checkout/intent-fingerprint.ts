/**
 * Canonical intent fingerprint for 6B.3 retry vs conflict detection.
 *
 * Reconstructable from persisted order columns (no extra schema field):
 * merchantId, contact snapshots, fulfillment, payment code, delivery
 * address/zone, productId, quantity, option group/choice ids + quantities.
 *
 * Pickup discovery zone (customerZoneId) is NOT included: Order does not
 * persist it. Same-key / different pickup zone cannot be distinguished from
 * stored rows without a future column.
 */
export type OrderIntentFingerprintInput = {
  merchantId: string;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string;
  fulfillmentMethod: string;
  paymentMethodCode: string;
  delivery: {
    zoneId: string;
    street: string;
    number: string;
    floorApartment: string;
    reference: string;
  } | null;
  lines: Array<{
    productId: string;
    quantity: number;
    options: Array<{
      optionGroupId: string;
      optionChoiceId: string;
      quantity: number;
    }>;
  }>;
};

export function buildOrderIntentFingerprint(
  input: OrderIntentFingerprintInput,
): string {
  const payload = {
    merchantId: input.merchantId,
    customerNameSnapshot: input.customerNameSnapshot,
    customerPhoneSnapshot: input.customerPhoneSnapshot,
    fulfillmentMethod: input.fulfillmentMethod,
    paymentMethodCode: input.paymentMethodCode,
    delivery: input.delivery,
    lines: input.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      options: [...line.options]
        .map((option) => ({
          optionGroupId: option.optionGroupId,
          optionChoiceId: option.optionChoiceId,
          quantity: option.quantity,
        }))
        .sort((a, b) =>
          `${a.optionGroupId}:${a.optionChoiceId}`.localeCompare(
            `${b.optionGroupId}:${b.optionChoiceId}`,
          ),
        ),
    })),
  };
  return JSON.stringify(payload);
}
