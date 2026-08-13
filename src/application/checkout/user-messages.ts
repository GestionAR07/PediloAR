import { CHECKOUT_ERROR_CODES } from "./errors";

const MESSAGES: Record<string, string> = {
  [CHECKOUT_ERROR_CODES.MERCHANT_NOT_FOUND]: "El comercio no existe.",
  [CHECKOUT_ERROR_CODES.MERCHANT_NOT_ACCEPTING]:
    "Este comercio no está tomando pedidos en este momento.",
  [CHECKOUT_ERROR_CODES.EMPTY_CART]: "El carrito está vacío.",
  [CHECKOUT_ERROR_CODES.INVALID_LINE]: "Hay un producto con datos inválidos.",
  [CHECKOUT_ERROR_CODES.PRODUCT_NOT_FOUND]:
    "Un producto del carrito ya no está disponible.",
  [CHECKOUT_ERROR_CODES.PRODUCT_FOREIGN_MERCHANT]:
    "Un producto no pertenece a este comercio.",
  [CHECKOUT_ERROR_CODES.PRODUCT_NOT_SELLABLE]:
    "Un producto ya no se puede pedir. Volvé al carrito para corregirlo.",
  [CHECKOUT_ERROR_CODES.INSUFFICIENT_STOCK]:
    "No hay stock suficiente. Volvé al carrito para corregir las cantidades.",
  [CHECKOUT_ERROR_CODES.INVALID_OPTION_SELECTION]:
    "La selección de opciones ya no es válida. Volvé al carrito para corregirla.",
  [CHECKOUT_ERROR_CODES.INVALID_FULFILLMENT]:
    "La modalidad de entrega no está disponible.",
  [CHECKOUT_ERROR_CODES.PICKUP_UNAVAILABLE]:
    "El retiro no está disponible para tu zona.",
  [CHECKOUT_ERROR_CODES.DELIVERY_ZONE_REQUIRED]:
    "Seleccioná una zona de envío.",
  [CHECKOUT_ERROR_CODES.DELIVERY_ZONE_NOT_SERVED]:
    "Este comercio no entrega en la zona seleccionada.",
  [CHECKOUT_ERROR_CODES.DELIVERY_MINIMUM_NOT_MET]:
    "El pedido no alcanza el mínimo de la zona.",
  [CHECKOUT_ERROR_CODES.DELIVERY_ADDRESS_REQUIRED]:
    "Completá la dirección de envío.",
  [CHECKOUT_ERROR_CODES.PAYMENT_METHOD_INVALID]:
    "Este comercio todavía no configuró medios de pago.",
  [CHECKOUT_ERROR_CODES.CONTACT_INVALID]:
    "Revisá el nombre y el teléfono de contacto.",
  [CHECKOUT_ERROR_CODES.IDEMPOTENCY_KEY_INVALID]:
    "No se pudo identificar el intento de pedido. Reintentá.",
  [CHECKOUT_ERROR_CODES.IDEMPOTENCY_CONFLICT]:
    "Este intento de pedido no coincide con uno ya registrado.",
  [CHECKOUT_ERROR_CODES.CHECKOUT_REVIEW_REQUIRED]:
    "El pedido cambió desde la última revisión. Revisá los datos actualizados antes de confirmar.",
  [CHECKOUT_ERROR_CODES.CHECKOUT_PAYLOAD_INVALID]:
    "No pudimos procesar el pedido. Revisá los datos e intentá de nuevo.",
  [CHECKOUT_ERROR_CODES.ORDER_PERSISTENCE_FAILED]:
    "No se pudo confirmar el pedido. Reintentá en un momento.",
};

export function checkoutUserMessage(
  code: string,
  fallback?: string,
  extra?: { minimumLabel?: string },
): string {
  if (
    code === CHECKOUT_ERROR_CODES.DELIVERY_MINIMUM_NOT_MET &&
    extra?.minimumLabel
  ) {
    return `Para esta zona el pedido mínimo es de ${extra.minimumLabel}.`;
  }
  if (code === CHECKOUT_ERROR_CODES.PAYMENT_METHOD_INVALID) {
    return (
      fallback ??
      "El medio de pago no es válido. Este comercio todavía no configuró medios de pago."
    );
  }
  return MESSAGES[code] ?? fallback ?? "No pudimos completar el pedido.";
}

export function isStaleCartError(code: string): boolean {
  return (
    code === CHECKOUT_ERROR_CODES.PRODUCT_NOT_FOUND ||
    code === CHECKOUT_ERROR_CODES.PRODUCT_NOT_SELLABLE ||
    code === CHECKOUT_ERROR_CODES.INSUFFICIENT_STOCK ||
    code === CHECKOUT_ERROR_CODES.INVALID_OPTION_SELECTION ||
    code === CHECKOUT_ERROR_CODES.PRODUCT_FOREIGN_MERCHANT
  );
}
