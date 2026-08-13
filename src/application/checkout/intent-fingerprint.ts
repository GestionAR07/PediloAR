import {
  parseCustomerNameSnapshot,
  parseCustomerPhoneSnapshot,
} from "@/domain/order/contact";
import { err, ok, type Result } from "@/domain/shared/result";
import type { PrepareOrderInput, PreparedOrder } from "./types";

/**
 * Canonical intent for idempotent retry vs conflict.
 *
 * Reconstructable from persisted Order + items + options (no extra column).
 * PICKUP customerZoneId is transient storefront eligibility — not part of intent.
 */
export type CanonicalDeliveryIntent = {
  zoneId: string;
  street: string;
  number: string;
  floorApartment: string;
  reference: string;
};

export type CanonicalOptionIntent = {
  optionGroupId: string;
  optionChoiceId: string;
  quantity: number;
};

export type CanonicalLineIntent = {
  productId: string;
  quantity: number;
  options: CanonicalOptionIntent[];
};

export type CanonicalOrderIntent = {
  merchantId: string;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string;
  fulfillmentMethod: string;
  paymentMethodCode: string;
  delivery: CanonicalDeliveryIntent | null;
  lines: CanonicalLineIntent[];
};

export type PersistedOrderIntentSource = {
  merchantId: string;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string;
  fulfillmentMethod: string;
  paymentMethodCode: string;
  deliveryZoneId: string | null;
  deliveryStreet: string | null;
  deliveryNumber: string | null;
  deliveryFloorApartment: string | null;
  deliveryReference: string | null;
  lines: Array<{
    productId: string | null;
    quantity: number;
    options: Array<{
      optionGroupId: string | null;
      optionChoiceId: string | null;
      quantity: number;
    }>;
  }>;
};

function sortOptions(
  options: readonly CanonicalOptionIntent[],
): CanonicalOptionIntent[] {
  return [...options]
    .map((option) => ({
      optionGroupId: option.optionGroupId,
      optionChoiceId: option.optionChoiceId,
      quantity: option.quantity,
    }))
    .sort((a, b) =>
      `${a.optionGroupId}:${a.optionChoiceId}`.localeCompare(
        `${b.optionGroupId}:${b.optionChoiceId}`,
      ),
    );
}

function lineKey(line: CanonicalLineIntent): string {
  return JSON.stringify({
    productId: line.productId,
    quantity: line.quantity,
    options: line.options,
  });
}

function canonicalizeLines(
  lines: readonly CanonicalLineIntent[],
): CanonicalLineIntent[] {
  return lines
    .map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      options: sortOptions(line.options),
    }))
    .sort((a, b) => lineKey(a).localeCompare(lineKey(b)));
}

function normalizeDelivery(
  fulfillmentMethod: string,
  delivery: CanonicalDeliveryIntent | null,
): CanonicalDeliveryIntent | null {
  if (fulfillmentMethod === "PICKUP" || delivery == null) {
    return null;
  }
  return {
    zoneId: delivery.zoneId,
    street: delivery.street.trim(),
    number: delivery.number.trim(),
    floorApartment: (delivery.floorApartment ?? "").trim(),
    reference: (delivery.reference ?? "").trim(),
  };
}

export function buildOrderIntentFingerprint(
  input: CanonicalOrderIntent,
): string {
  const payload: CanonicalOrderIntent = {
    merchantId: input.merchantId,
    customerNameSnapshot: input.customerNameSnapshot,
    customerPhoneSnapshot: input.customerPhoneSnapshot,
    fulfillmentMethod: input.fulfillmentMethod,
    paymentMethodCode: input.paymentMethodCode,
    delivery: normalizeDelivery(input.fulfillmentMethod, input.delivery),
    lines: canonicalizeLines(input.lines),
  };
  return JSON.stringify(payload);
}

export function canonicalIntentFromRequest(
  input: PrepareOrderInput,
): Result<string, "CONTACT_INVALID"> {
  const nameResult = parseCustomerNameSnapshot(input.customer?.name ?? "");
  const phoneResult = parseCustomerPhoneSnapshot(input.customer?.phone ?? "");
  if (!nameResult.ok || !phoneResult.ok) {
    return err("CONTACT_INVALID");
  }

  const fulfillmentMethod = String(input.fulfillmentMethod ?? "");
  const delivery =
    fulfillmentMethod === "PICKUP"
      ? null
      : {
          zoneId: input.delivery?.zoneId ?? "",
          street: (input.delivery?.street ?? "").trim(),
          number: (input.delivery?.number ?? "").trim(),
          floorApartment: (input.delivery?.floorApartment ?? "").trim(),
          reference: (input.delivery?.reference ?? "").trim(),
        };

  return ok(
    buildOrderIntentFingerprint({
      merchantId: input.merchantId,
      customerNameSnapshot: nameResult.value,
      customerPhoneSnapshot: phoneResult.value,
      fulfillmentMethod,
      paymentMethodCode: String(input.paymentMethodCode ?? ""),
      delivery,
      lines: (input.lines ?? []).map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        options: (line.groups ?? []).flatMap((group) =>
          group.selections.map((selection) => ({
            optionGroupId: group.groupId,
            optionChoiceId: selection.choiceId,
            quantity: selection.quantity,
          })),
        ),
      })),
    }),
  );
}

export function canonicalIntentFromPrepared(order: PreparedOrder): string {
  return buildOrderIntentFingerprint({
    merchantId: order.merchantId,
    customerNameSnapshot: order.customerNameSnapshot,
    customerPhoneSnapshot: order.customerPhoneSnapshot,
    fulfillmentMethod: order.fulfillmentMethod,
    paymentMethodCode: order.paymentMethodSnapshot.code,
    delivery:
      order.fulfillmentMethod === "PICKUP" || order.delivery == null
        ? null
        : {
            zoneId: order.delivery.zoneId,
            street: order.delivery.street,
            number: order.delivery.number,
            floorApartment: order.delivery.floorApartment,
            reference: order.delivery.reference,
          },
    lines: order.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      options: line.options.map((option) => ({
        optionGroupId: option.optionGroupId,
        optionChoiceId: option.optionChoiceId,
        quantity: option.quantity,
      })),
    })),
  });
}

export function canonicalIntentFromPersisted(
  source: PersistedOrderIntentSource,
): string {
  const delivery =
    source.fulfillmentMethod === "PICKUP" || !source.deliveryZoneId
      ? null
      : {
          zoneId: source.deliveryZoneId,
          street: source.deliveryStreet ?? "",
          number: source.deliveryNumber ?? "",
          floorApartment: source.deliveryFloorApartment ?? "",
          reference: source.deliveryReference ?? "",
        };

  return buildOrderIntentFingerprint({
    merchantId: source.merchantId,
    customerNameSnapshot: source.customerNameSnapshot,
    customerPhoneSnapshot: source.customerPhoneSnapshot,
    fulfillmentMethod: source.fulfillmentMethod,
    paymentMethodCode: source.paymentMethodCode,
    delivery,
    lines: source.lines.map((line) => ({
      productId: line.productId ?? "",
      quantity: line.quantity,
      options: line.options.map((option) => ({
        optionGroupId: option.optionGroupId ?? "",
        optionChoiceId: option.optionChoiceId ?? "",
        quantity: option.quantity,
      })),
    })),
  });
}
