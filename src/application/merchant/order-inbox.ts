import { shortOrderReference } from "@/application/checkout/placed-order-view";
import { err, ok, type Result } from "@/domain/shared/result";
import { isValidUuid } from "@/lib/uuid";
import type {
  MerchantOrderDeliveryRecord,
  MerchantOrderItemRecord,
  MerchantOrderRecord,
} from "@/infrastructure/db/repositories/merchant-order-repository";

export type MerchantOrderApplicationError = {
  code: string;
  message: string;
};

export const MERCHANT_ORDER_ALLOWED_ROLES = ["OWNER", "STAFF"] as const;

export type MerchantOrderOptionView = {
  groupName: string;
  choiceName: string;
  priceDeltaCents: number;
  quantity: number;
};

export type MerchantOrderItemView = {
  productName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  notes: string;
  options: MerchantOrderOptionView[];
};

export type MerchantOrderDeliveryView = {
  status: string;
  statusLabel: string;
  zoneName: string | null;
  cityName: string | null;
  street: string;
  number: string;
  floorApartment: string | null;
  reference: string | null;
  estimatedMinutes: number | null;
};

export type MerchantOrderCancellationView = {
  canceledBy: string;
  cancelReason: string | null;
  headline: string;
  detail: string | null;
};

export type MerchantOrderView = {
  orderId: string;
  shortRef: string;
  createdAt: Date;
  status: string;
  statusLabel: string;
  fulfillmentMethod: string;
  fulfillmentLabel: string;
  customer: {
    name: string;
    phone: string;
  };
  money: {
    orderSubtotalCents: number;
    deliveryFeeCents: number;
    totalCents: number;
  };
  items: MerchantOrderItemView[];
  payment: {
    code: string;
    label: string;
    instructions: string;
  };
  delivery: MerchantOrderDeliveryView | null;
  cancellation: MerchantOrderCancellationView | null;
};

export type MerchantInboxGroupId =
  "attention" | "preparing" | "ready" | "today";

export type MerchantInboxView = {
  attention: MerchantOrderView[];
  preparing: MerchantOrderView[];
  ready: MerchantOrderView[];
  today: MerchantOrderView[];
};

export type MerchantOrderInboxDeps = {
  requireMerchantOrderAccess: (merchantId: string) => Promise<void>;
  listOrdersForMerchant: (
    merchantId: string,
    terminalSince: Date,
  ) => Promise<MerchantOrderRecord[]>;
  findOrderForMerchant: (
    merchantId: string,
    orderId: string,
  ) => Promise<MerchantOrderRecord | null>;
};

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  REQUESTED: "Solicitado",
  ASSIGNED: "Asignado",
  PICKED_UP: "Retirado",
  IN_TRANSIT: "En camino",
  DELIVERED: "Entregado",
  FAILED: "Fallido",
  CANCELED: "Cancelado",
};

const CANCEL_REASON_LABELS: Record<string, string> = {
  CUSTOMER_REQUEST: "Solicitud del cliente",
  MERCHANT_UNAVAILABLE: "Comercio no disponible",
  OUT_OF_STOCK: "Sin stock",
  PAYMENT_ISSUE: "Problema de pago",
  OTHER: "Otro",
};

export function presentMerchantCancellation(
  canceledBy: string | null,
  cancelReason: string | null,
): MerchantOrderCancellationView | null {
  if (!canceledBy) {
    return null;
  }

  let headline = "Cancelado";
  if (canceledBy === "MERCHANT_USER") {
    headline = "Rechazado por el comercio";
  } else if (canceledBy === "CUSTOMER") {
    headline = "Cancelado por el cliente";
  }

  return {
    canceledBy,
    cancelReason,
    headline,
    detail: cancelReason
      ? (CANCEL_REASON_LABELS[cancelReason] ?? cancelReason)
      : null,
  };
}

export function presentMerchantOrderStatusLabel(input: {
  status: string;
  deliveryStatus: string | null;
}): string {
  if (input.status === "PENDING") return "Nuevo";
  if (input.status === "ACCEPTED") return "Aceptado";
  if (input.status === "PREPARING") return "Preparando";
  if (input.status === "READY" && input.deliveryStatus === "IN_TRANSIT") {
    return "En camino";
  }
  if (input.status === "READY") return "Listo";
  if (input.status === "COMPLETED") return "Completado";
  if (input.status === "CANCELED") return "Cancelado";
  return input.status;
}

export function merchantInboxGroupFor(input: {
  status: string;
  deliveryStatus: string | null;
}): MerchantInboxGroupId {
  if (input.status === "PENDING") return "attention";
  if (input.status === "ACCEPTED" || input.status === "PREPARING") {
    return "preparing";
  }
  if (input.status === "READY") return "ready";
  return "today";
}

export function presentMerchantOrder(
  record: MerchantOrderRecord,
): MerchantOrderView {
  const delivery = presentDelivery(record.fulfillmentMethod, record.delivery);
  const statusLabel = presentMerchantOrderStatusLabel({
    status: record.status,
    deliveryStatus: delivery?.status ?? null,
  });
  const cancellation =
    record.status === "CANCELED"
      ? presentMerchantCancellation(record.canceledBy, record.cancelReason)
      : null;

  return {
    orderId: record.id,
    shortRef: shortOrderReference(record.id),
    createdAt: record.createdAt,
    status: record.status,
    statusLabel:
      record.status === "CANCELED" && cancellation
        ? cancellation.headline
        : statusLabel,
    fulfillmentMethod: record.fulfillmentMethod,
    fulfillmentLabel:
      record.fulfillmentMethod === "PICKUP" ? "Retiro" : "Envío",
    customer: {
      name: record.customerNameSnapshot,
      phone: record.customerPhoneSnapshot,
    },
    money: {
      orderSubtotalCents: record.orderSubtotalCents,
      deliveryFeeCents: record.deliveryFeeCents,
      totalCents: record.totalCents,
    },
    items: record.items.map(presentItem),
    payment: {
      code: record.paymentMethodCode,
      label: record.paymentMethodLabel,
      instructions: record.paymentMethodInstructions,
    },
    delivery,
    cancellation,
  };
}

function presentItem(item: MerchantOrderItemRecord): MerchantOrderItemView {
  return {
    productName: item.productNameSnapshot,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    lineTotalCents: item.lineTotalCents,
    notes: item.itemNotes.trim(),
    options: item.options.map((option) => ({
      groupName: option.groupNameSnapshot,
      choiceName: option.choiceNameSnapshot,
      priceDeltaCents: option.priceDeltaCents,
      quantity: option.quantity,
    })),
  };
}

function presentDelivery(
  fulfillmentMethod: string,
  delivery: MerchantOrderDeliveryRecord | null,
): MerchantOrderDeliveryView | null {
  if (fulfillmentMethod === "PICKUP" || !delivery) {
    return null;
  }
  const floor = delivery.floorApartment?.trim() || null;
  const reference = delivery.reference?.trim() || null;
  return {
    status: delivery.status,
    statusLabel: DELIVERY_STATUS_LABELS[delivery.status] ?? delivery.status,
    zoneName: delivery.zoneNameSnapshot,
    cityName: delivery.cityNameSnapshot,
    street: delivery.street,
    number: delivery.number,
    floorApartment: floor,
    reference,
    estimatedMinutes: delivery.estimatedMinutes,
  };
}

export function groupMerchantInbox(
  views: readonly MerchantOrderView[],
): MerchantInboxView {
  const inbox: MerchantInboxView = {
    attention: [],
    preparing: [],
    ready: [],
    today: [],
  };

  for (const view of views) {
    const group = merchantInboxGroupFor({
      status: view.status,
      deliveryStatus: view.delivery?.status ?? null,
    });
    inbox[group].push(view);
  }

  return inbox;
}

export async function listMerchantInbox(
  merchantId: string,
  terminalSince: Date,
  deps: MerchantOrderInboxDeps,
): Promise<Result<MerchantInboxView, MerchantOrderApplicationError>> {
  await deps.requireMerchantOrderAccess(merchantId);
  if (!isValidUuid(merchantId)) {
    return err({ code: "INVALID_MERCHANT", message: "Comercio inválido." });
  }

  try {
    const rows = await deps.listOrdersForMerchant(merchantId, terminalSince);
    const views = rows.map((row) => presentMerchantOrder(row));
    return ok(groupMerchantInbox(views));
  } catch {
    return err({
      code: "INBOX_UNAVAILABLE",
      message: "No pudimos cargar los pedidos.",
    });
  }
}

export async function getMerchantOrder(
  merchantId: string,
  orderId: string,
  deps: MerchantOrderInboxDeps,
): Promise<Result<MerchantOrderView, MerchantOrderApplicationError>> {
  await deps.requireMerchantOrderAccess(merchantId);
  if (!isValidUuid(merchantId) || !isValidUuid(orderId)) {
    return err({ code: "ORDER_NOT_FOUND", message: "El pedido no existe." });
  }

  try {
    const row = await deps.findOrderForMerchant(merchantId, orderId);
    if (!row) {
      return err({ code: "ORDER_NOT_FOUND", message: "El pedido no existe." });
    }
    return ok(presentMerchantOrder(row));
  } catch {
    return err({
      code: "ORDER_UNAVAILABLE",
      message: "No pudimos cargar el pedido.",
    });
  }
}
