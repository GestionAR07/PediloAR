import { createHash } from "node:crypto";
import type { PreparedOrder } from "./types";

/**
 * Buyer-safe authoritative checkout review. Money fields are plain integers
 * (centavos) so Client Components can serialize them without BigInt.
 */
export type CheckoutReviewLineOption = {
  optionGroupId: string;
  optionChoiceId: string;
  groupName: string;
  choiceName: string;
  quantity: number;
  priceDeltaCents: number;
};

export type CheckoutReviewLine = {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  options: CheckoutReviewLineOption[];
};

export type CheckoutReviewDelivery = {
  zoneId: string;
  zoneName: string;
  cityName: string;
  street: string;
  number: string;
  floorApartment: string;
  reference: string;
  estimatedMinutes: number;
};

export type CheckoutReview = {
  merchantId: string;
  merchantName: string;
  fulfillmentMethod: "PICKUP" | "MERCHANT_DELIVERY";
  lines: CheckoutReviewLine[];
  itemSubtotalCents: number;
  optionsSubtotalCents: number;
  orderSubtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  payment: {
    code: string;
    label: string;
    instructions: string;
  };
  delivery: CheckoutReviewDelivery | null;
  quoteFingerprint: string;
};

type QuoteCanonicalLine = {
  productId: string;
  productName: string;
  unitPriceCents: number;
  quantity: number;
  options: Array<{
    optionGroupId: string;
    optionChoiceId: string;
    groupName: string;
    choiceName: string;
    priceDeltaCents: number;
    quantity: number;
  }>;
};

export type QuoteCanonicalPayload = {
  merchantId: string;
  merchantName: string;
  fulfillmentMethod: string;
  lines: QuoteCanonicalLine[];
  itemSubtotalCents: number;
  optionsSubtotalCents: number;
  orderSubtotalCents: number;
  deliveryZoneId: string | null;
  deliveryZoneName: string | null;
  deliveryCityName: string | null;
  deliveryFeeCents: number;
  totalCents: number;
  paymentCode: string;
  paymentLabel: string;
  paymentInstructions: string;
};

function sortLines(lines: QuoteCanonicalLine[]): QuoteCanonicalLine[] {
  return [...lines]
    .map((line) => ({
      ...line,
      options: [...line.options].sort((a, b) =>
        `${a.optionGroupId}:${a.optionChoiceId}`.localeCompare(
          `${b.optionGroupId}:${b.optionChoiceId}`,
        ),
      ),
    }))
    .sort((a, b) => {
      const left = `${a.productId}:${a.quantity}:${JSON.stringify(a.options)}`;
      const right = `${b.productId}:${b.quantity}:${JSON.stringify(b.options)}`;
      return left.localeCompare(right);
    });
}

export function canonicalQuotePayload(
  order: PreparedOrder,
): QuoteCanonicalPayload {
  return {
    merchantId: order.merchantId,
    merchantName: order.merchantNameSnapshot,
    fulfillmentMethod: order.fulfillmentMethod,
    lines: sortLines(
      order.lines.map((line) => ({
        productId: line.productId,
        productName: line.productNameSnapshot,
        unitPriceCents: Number(line.unitPriceCents),
        quantity: line.quantity,
        options: line.options.map((option) => ({
          optionGroupId: option.optionGroupId,
          optionChoiceId: option.optionChoiceId,
          groupName: option.optionGroupNameSnapshot,
          choiceName: option.optionChoiceNameSnapshot,
          priceDeltaCents: Number(option.priceDeltaCents),
          quantity: option.quantity,
        })),
      })),
    ),
    itemSubtotalCents: Number(order.itemSubtotalCents),
    optionsSubtotalCents: Number(order.optionsSubtotalCents),
    orderSubtotalCents: Number(order.orderSubtotalCents),
    deliveryZoneId: order.delivery?.zoneId ?? null,
    deliveryZoneName: order.delivery?.zoneNameSnapshot ?? null,
    deliveryCityName: order.delivery?.cityNameSnapshot ?? null,
    deliveryFeeCents: Number(order.deliveryFeeCents),
    totalCents: Number(order.totalCents),
    paymentCode: order.paymentMethodSnapshot.code,
    paymentLabel: order.paymentMethodSnapshot.label,
    paymentInstructions: order.paymentMethodSnapshot.instructions,
  };
}

export function buildQuoteFingerprint(order: PreparedOrder): string {
  const canonical = JSON.stringify(canonicalQuotePayload(order));
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function toCheckoutReview(order: PreparedOrder): CheckoutReview {
  const quoteFingerprint = buildQuoteFingerprint(order);
  return {
    merchantId: order.merchantId,
    merchantName: order.merchantNameSnapshot,
    fulfillmentMethod:
      order.fulfillmentMethod === "MERCHANT_DELIVERY"
        ? "MERCHANT_DELIVERY"
        : "PICKUP",
    lines: order.lines.map((line) => ({
      productId: line.productId,
      productName: line.productNameSnapshot,
      quantity: line.quantity,
      unitPriceCents: Number(line.unitPriceCents),
      lineTotalCents: Number(line.lineTotalCents),
      options: line.options.map((option) => ({
        optionGroupId: option.optionGroupId,
        optionChoiceId: option.optionChoiceId,
        groupName: option.optionGroupNameSnapshot,
        choiceName: option.optionChoiceNameSnapshot,
        quantity: option.quantity,
        priceDeltaCents: Number(option.priceDeltaCents),
      })),
    })),
    itemSubtotalCents: Number(order.itemSubtotalCents),
    optionsSubtotalCents: Number(order.optionsSubtotalCents),
    orderSubtotalCents: Number(order.orderSubtotalCents),
    deliveryFeeCents: Number(order.deliveryFeeCents),
    totalCents: Number(order.totalCents),
    payment: {
      code: order.paymentMethodSnapshot.code,
      label: order.paymentMethodSnapshot.label,
      instructions: order.paymentMethodSnapshot.instructions,
    },
    delivery: order.delivery
      ? {
          zoneId: order.delivery.zoneId,
          zoneName: order.delivery.zoneNameSnapshot,
          cityName: order.delivery.cityNameSnapshot,
          street: order.delivery.street,
          number: order.delivery.number,
          floorApartment: order.delivery.floorApartment,
          reference: order.delivery.reference,
          estimatedMinutes: order.delivery.estimatedMinutes,
        }
      : null,
    quoteFingerprint,
  };
}
