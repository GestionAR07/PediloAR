import type { Cart } from "@/domain/cart/types";
import { emptyCart, isCartEmpty } from "@/domain/cart/types";
import { parseCartJson } from "@/lib/cart/storage";
import { err, ok, type Result } from "@/domain/shared/result";
import { isValidUuid } from "@/lib/uuid";
import {
  checkoutError,
  CHECKOUT_ERROR_CODES,
  type CheckoutApplicationError,
} from "./errors";
import type { PrepareOrderInput, PrepareOrderLineInput } from "./types";

export const MAX_CHECKOUT_LINES = 40;
export const MAX_GROUPS_PER_LINE = 16;
export const MAX_SELECTIONS_PER_GROUP = 40;
export const MAX_LINE_QUANTITY = 99;
export const MAX_STREET_LENGTH = 120;
export const MAX_NUMBER_LENGTH = 32;
export const MAX_FLOOR_LENGTH = 40;
export const MAX_REFERENCE_LENGTH = 160;
export const MAX_PAYLOAD_JSON_CHARS = 40_000;

export type CheckoutFormDraft = {
  merchantId: string;
  customerZoneId: string;
  customerName: string;
  customerPhone: string;
  fulfillmentMethod: string;
  deliveryZoneId: string;
  street: string;
  number: string;
  floorApartment: string;
  reference: string;
  paymentMethodCode: string;
  idempotencyKey: string;
  expectedQuoteFingerprint?: string | null;
};

function fail(
  code: (typeof CHECKOUT_ERROR_CODES)[keyof typeof CHECKOUT_ERROR_CODES],
  message: string,
): Result<PrepareOrderInput, CheckoutApplicationError> {
  return err(checkoutError(code, message));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function mapCartToPrepareLines(cart: Cart): PrepareOrderLineInput[] {
  return cart.lines.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
    groups: line.configuration.map((group) => ({
      groupId: group.groupId,
      selections: group.selections.map((selection) => ({
        choiceId: selection.choiceId,
        quantity: selection.quantity,
      })),
    })),
  }));
}

export function checkoutRequestSignature(
  cart: Cart,
  draft: Omit<CheckoutFormDraft, "idempotencyKey" | "expectedQuoteFingerprint">,
): string {
  return JSON.stringify({
    merchantId: draft.merchantId,
    customerZoneId: draft.customerZoneId,
    customerName: draft.customerName.trim(),
    customerPhone: draft.customerPhone.trim(),
    fulfillmentMethod: draft.fulfillmentMethod,
    deliveryZoneId: draft.deliveryZoneId,
    street: draft.street.trim(),
    number: draft.number.trim(),
    floorApartment: draft.floorApartment.trim(),
    reference: draft.reference.trim(),
    paymentMethodCode: draft.paymentMethodCode,
    lines: mapCartToPrepareLines(cart),
  });
}

export function parseCartFromUnknown(raw: unknown): Cart {
  try {
    return parseCartJson(JSON.stringify(raw));
  } catch {
    return emptyCart();
  }
}

function parseDraftFromUnknown(raw: unknown): CheckoutFormDraft | null {
  if (!isRecord(raw)) return null;
  return {
    merchantId: asString(raw.merchantId),
    customerZoneId: asString(raw.customerZoneId),
    customerName: asString(raw.customerName),
    customerPhone: asString(raw.customerPhone),
    fulfillmentMethod: asString(raw.fulfillmentMethod),
    deliveryZoneId: asString(raw.deliveryZoneId),
    street: asString(raw.street),
    number: asString(raw.number),
    floorApartment: asString(raw.floorApartment),
    reference: asString(raw.reference),
    paymentMethodCode: asString(raw.paymentMethodCode),
    idempotencyKey: asString(raw.idempotencyKey),
    expectedQuoteFingerprint: asString(raw.expectedQuoteFingerprint) || null,
  };
}

export function parseCheckoutInput(
  cart: Cart,
  draft: CheckoutFormDraft,
): Result<PrepareOrderInput, CheckoutApplicationError> {
  const serialized = JSON.stringify({
    cart: mapCartToPrepareLines(cart),
    draft,
  });
  if (serialized.length > MAX_PAYLOAD_JSON_CHARS) {
    return fail(
      CHECKOUT_ERROR_CODES.CHECKOUT_PAYLOAD_INVALID,
      "El pedido es demasiado grande.",
    );
  }

  if (isCartEmpty(cart) || cart.lines.length === 0) {
    return fail(CHECKOUT_ERROR_CODES.EMPTY_CART, "El carrito está vacío.");
  }

  if (cart.merchantId !== draft.merchantId) {
    return fail(
      CHECKOUT_ERROR_CODES.CHECKOUT_PAYLOAD_INVALID,
      "El comercio del carrito no coincide.",
    );
  }

  if (!isValidUuid(draft.merchantId)) {
    return fail(
      CHECKOUT_ERROR_CODES.MERCHANT_NOT_FOUND,
      "El comercio no existe.",
    );
  }

  if (cart.lines.length > MAX_CHECKOUT_LINES) {
    return fail(
      CHECKOUT_ERROR_CODES.CHECKOUT_PAYLOAD_INVALID,
      "El pedido tiene demasiados productos.",
    );
  }

  for (const line of cart.lines) {
    if (!isValidUuid(line.productId)) {
      return fail(
        CHECKOUT_ERROR_CODES.CHECKOUT_PAYLOAD_INVALID,
        "Hay un producto con identificador inválido.",
      );
    }
    if (
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > MAX_LINE_QUANTITY
    ) {
      return fail(
        CHECKOUT_ERROR_CODES.INVALID_LINE,
        "Hay un producto con cantidad inválida.",
      );
    }
    if ((line.configuration?.length ?? 0) > MAX_GROUPS_PER_LINE) {
      return fail(
        CHECKOUT_ERROR_CODES.CHECKOUT_PAYLOAD_INVALID,
        "Un producto tiene demasiados grupos de opciones.",
      );
    }
    for (const group of line.configuration) {
      if (!isValidUuid(group.groupId)) {
        return fail(
          CHECKOUT_ERROR_CODES.CHECKOUT_PAYLOAD_INVALID,
          "Una selección de opciones no es válida.",
        );
      }
      if (group.selections.length > MAX_SELECTIONS_PER_GROUP) {
        return fail(
          CHECKOUT_ERROR_CODES.CHECKOUT_PAYLOAD_INVALID,
          "Una selección de opciones es demasiado grande.",
        );
      }
      for (const selection of group.selections) {
        if (!isValidUuid(selection.choiceId)) {
          return fail(
            CHECKOUT_ERROR_CODES.CHECKOUT_PAYLOAD_INVALID,
            "Una selección de opciones no es válida.",
          );
        }
      }
    }
  }

  const fulfillmentMethod = draft.fulfillmentMethod;
  if (
    fulfillmentMethod !== "PICKUP" &&
    fulfillmentMethod !== "MERCHANT_DELIVERY"
  ) {
    return fail(
      CHECKOUT_ERROR_CODES.INVALID_FULFILLMENT,
      "La modalidad de entrega no es válida.",
    );
  }

  let delivery: PrepareOrderInput["delivery"] = null;
  if (fulfillmentMethod === "MERCHANT_DELIVERY") {
    const street = draft.street.trim();
    const number = draft.number.trim();
    const floorApartment = draft.floorApartment.trim();
    const reference = draft.reference.trim();
    if (!isValidUuid(draft.deliveryZoneId)) {
      return fail(
        CHECKOUT_ERROR_CODES.DELIVERY_ZONE_REQUIRED,
        "Seleccioná una zona de envío.",
      );
    }
    if (!street || !number) {
      return fail(
        CHECKOUT_ERROR_CODES.DELIVERY_ADDRESS_REQUIRED,
        "Completá calle y número para el envío.",
      );
    }
    if (
      street.length > MAX_STREET_LENGTH ||
      number.length > MAX_NUMBER_LENGTH
    ) {
      return fail(
        CHECKOUT_ERROR_CODES.DELIVERY_ADDRESS_REQUIRED,
        "La dirección es demasiado larga.",
      );
    }
    if (
      floorApartment.length > MAX_FLOOR_LENGTH ||
      reference.length > MAX_REFERENCE_LENGTH
    ) {
      return fail(
        CHECKOUT_ERROR_CODES.DELIVERY_ADDRESS_REQUIRED,
        "Piso o referencia son demasiado largos.",
      );
    }
    delivery = {
      zoneId: draft.deliveryZoneId,
      street,
      number,
      floorApartment,
      reference,
    };
  }

  const customerZoneId = draft.customerZoneId.trim();
  if (customerZoneId && !isValidUuid(customerZoneId)) {
    return fail(
      CHECKOUT_ERROR_CODES.CHECKOUT_PAYLOAD_INVALID,
      "La zona seleccionada no es válida.",
    );
  }

  return ok({
    merchantId: draft.merchantId,
    customerZoneId: customerZoneId || null,
    customer: {
      name: draft.customerName,
      phone: draft.customerPhone,
    },
    fulfillmentMethod,
    delivery,
    paymentMethodCode: draft.paymentMethodCode,
    idempotencyKey: draft.idempotencyKey,
    expectedQuoteFingerprint: draft.expectedQuoteFingerprint ?? null,
    lines: mapCartToPrepareLines(cart),
  });
}

export function parseCheckoutPayload(
  payload: unknown,
): Result<PrepareOrderInput, CheckoutApplicationError> {
  if (!isRecord(payload)) {
    return fail(
      CHECKOUT_ERROR_CODES.CHECKOUT_PAYLOAD_INVALID,
      "No pudimos procesar el pedido.",
    );
  }

  const cart = parseCartFromUnknown(payload.cart);
  const draft = parseDraftFromUnknown(payload.draft);
  if (!draft) {
    return fail(
      CHECKOUT_ERROR_CODES.CHECKOUT_PAYLOAD_INVALID,
      "No pudimos procesar el pedido.",
    );
  }

  return parseCheckoutInput(cart, draft);
}
