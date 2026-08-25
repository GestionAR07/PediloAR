import { shortOrderReference } from "@/application/checkout/placed-order-view";
import { ORDER_TERMINAL_STATUSES } from "@/domain/order/transitions";
import { err, ok, type Result } from "@/domain/shared/result";
import { isValidUuid } from "@/lib/uuid";
import type {
  CustomerOrderDetailRecord,
  CustomerOrderSummaryRecord,
} from "@/infrastructure/db/repositories/customer-order-repository";

export type CustomerOrderError = {
  code: "ORDER_NOT_FOUND" | "ORDERS_UNAVAILABLE";
  message: string;
};

export type CustomerOrderSummaryView = {
  orderId: string;
  orderRef: string;
  merchantName: string;
  status: string;
  statusLabel: string;
  statusDetail: string;
  fulfillmentLabel: string;
  totalCents: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomerOrderDetailView = CustomerOrderSummaryView & {
  contact: { name: string; phone: string };
  money: {
    orderSubtotalCents: number;
    deliveryFeeCents: number;
    totalCents: number;
  };
  payment: { label: string; instructions: string };
  delivery: {
    statusLabel: string;
    addressLabel: string;
    reference: string | null;
    estimatedMinutes: number | null;
  } | null;
  items: Array<{
    id: string;
    name: string;
    unitPriceCents: number;
    quantity: number;
    lineTotalCents: number;
    options: Array<{
      groupName: string;
      choiceName: string;
      priceDeltaCents: number;
      quantity: number;
    }>;
  }>;
  timeline: Array<{
    status: string;
    label: string;
    detail: string;
    createdAt: Date;
  }>;
  cancellation: { headline: string; detail: string | null } | null;
};

export type CustomerOrdersView = {
  active: CustomerOrderSummaryView[];
  history: CustomerOrderSummaryView[];
};

export type CustomerOrderDeps = {
  listOrdersForCustomer: (
    customerUserId: string,
  ) => Promise<CustomerOrderSummaryRecord[]>;
  findOrderForCustomer: (
    customerUserId: string,
    orderId: string,
  ) => Promise<CustomerOrderDetailRecord | null>;
};

const DELIVERY_LABELS: Record<string, string> = {
  PENDING: "Preparando el envío",
  REQUESTED: "Envío solicitado",
  ASSIGNED: "Repartidor asignado",
  PICKED_UP: "Pedido retirado",
  IN_TRANSIT: "En camino",
  DELIVERED: "Entregado",
  FAILED: "No se pudo entregar",
  CANCELED: "Envío cancelado",
};

const CANCEL_REASON_LABELS: Record<string, string> = {
  CUSTOMER_REQUEST: "Lo solicitaste desde tu cuenta.",
  MERCHANT_UNAVAILABLE: "El comercio no pudo tomar el pedido.",
  OUT_OF_STOCK: "El comercio informó falta de stock.",
  PAYMENT_ISSUE: "Hubo un inconveniente con el pago.",
  OTHER: "El pedido no pudo continuar.",
};

export function presentCustomerStatus(input: {
  status: string;
  fulfillmentMethod: string;
  deliveryStatus: string | null;
}): { label: string; detail: string } {
  if (input.status === "PENDING") {
    return {
      label: "Esperando confirmación",
      detail: "El comercio recibió tu pedido y debe aceptarlo.",
    };
  }
  if (input.status === "ACCEPTED") {
    return {
      label: "Pedido aceptado",
      detail: "El comercio confirmó tu pedido.",
    };
  }
  if (input.status === "PREPARING") {
    return {
      label: "En preparación",
      detail: "El comercio está preparando tu pedido.",
    };
  }
  if (input.status === "READY" && input.deliveryStatus === "IN_TRANSIT") {
    return { label: "En camino", detail: "Tu pedido está viajando hacia vos." };
  }
  if (input.status === "READY") {
    return input.fulfillmentMethod === "PICKUP"
      ? {
          label: "Listo para retirar",
          detail: "Ya podés pasar por el comercio.",
        }
      : {
          label: "Listo para enviar",
          detail: "El pedido terminó de prepararse.",
        };
  }
  if (input.status === "COMPLETED") {
    return { label: "Completado", detail: "El pedido fue entregado." };
  }
  if (input.status === "CANCELED") {
    return { label: "Cancelado", detail: "El pedido fue cancelado." };
  }
  return { label: input.status, detail: "Estado actualizado por el comercio." };
}

export function presentCustomerOrderSummary(
  record: CustomerOrderSummaryRecord,
): CustomerOrderSummaryView {
  const presentation = presentCustomerStatus(record);
  return {
    orderId: record.id,
    orderRef: shortOrderReference(record.id),
    merchantName: record.merchantNameSnapshot,
    status: record.status,
    statusLabel: presentation.label,
    statusDetail: presentation.detail,
    fulfillmentLabel:
      record.fulfillmentMethod === "PICKUP" ? "Retiro" : "Envío",
    totalCents: record.totalCents,
    active: !(ORDER_TERMINAL_STATUSES as readonly string[]).includes(
      record.status,
    ),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function presentCustomerOrderDetail(
  record: CustomerOrderDetailRecord,
): CustomerOrderDetailView {
  const summary = presentCustomerOrderSummary(record);
  const cancellation =
    record.status === "CANCELED"
      ? {
          headline:
            record.canceledBy === "CUSTOMER"
              ? "Cancelado por vos"
              : record.canceledBy === "MERCHANT_USER"
                ? "Cancelado por el comercio"
                : "Pedido cancelado",
          detail: record.cancelReason
            ? (CANCEL_REASON_LABELS[record.cancelReason] ?? null)
            : null,
        }
      : null;

  return {
    ...summary,
    contact: {
      name: record.customerNameSnapshot,
      phone: record.customerPhoneSnapshot,
    },
    money: {
      orderSubtotalCents: record.orderSubtotalCents,
      deliveryFeeCents: record.deliveryFeeCents,
      totalCents: record.totalCents,
    },
    payment: {
      label: record.paymentMethodLabel,
      instructions: record.paymentMethodInstructions,
    },
    delivery: record.deliveryAddress
      ? {
          statusLabel:
            DELIVERY_LABELS[record.deliveryStatus ?? ""] ?? "En preparación",
          addressLabel: [
            `${record.deliveryAddress.street} ${record.deliveryAddress.number}`,
            record.deliveryAddress.floorApartment,
            record.deliveryAddress.zoneName,
            record.deliveryAddress.cityName,
          ]
            .filter(Boolean)
            .join(" · "),
          reference: record.deliveryAddress.reference?.trim() || null,
          estimatedMinutes: record.deliveryAddress.estimatedMinutes,
        }
      : null,
    items: record.items.map((item) => ({
      id: item.id,
      name: item.productNameSnapshot,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
      lineTotalCents: item.lineTotalCents,
      options: item.options.map((option) => ({
        groupName: option.groupNameSnapshot,
        choiceName: option.choiceNameSnapshot,
        priceDeltaCents: option.priceDeltaCents,
        quantity: option.quantity,
      })),
    })),
    timeline: record.events.map((event) => {
      const status = presentCustomerStatus({
        status: event.toStatus,
        fulfillmentMethod: record.fulfillmentMethod,
        deliveryStatus: record.deliveryStatus,
      });
      return {
        status: event.toStatus,
        label: status.label,
        detail: status.detail,
        createdAt: event.createdAt,
      };
    }),
    cancellation,
  };
}

export async function listCustomerOrders(
  customerUserId: string,
  deps: CustomerOrderDeps,
): Promise<Result<CustomerOrdersView, CustomerOrderError>> {
  try {
    const orders = (await deps.listOrdersForCustomer(customerUserId)).map(
      presentCustomerOrderSummary,
    );
    return ok({
      active: orders.filter((order) => order.active),
      history: orders.filter((order) => !order.active),
    });
  } catch {
    return err({
      code: "ORDERS_UNAVAILABLE",
      message: "No pudimos cargar tus pedidos.",
    });
  }
}

export async function getCustomerOrder(
  customerUserId: string,
  orderId: string,
  deps: CustomerOrderDeps,
): Promise<Result<CustomerOrderDetailView, CustomerOrderError>> {
  if (!isValidUuid(orderId)) {
    return err({ code: "ORDER_NOT_FOUND", message: "El pedido no existe." });
  }
  try {
    const order = await deps.findOrderForCustomer(customerUserId, orderId);
    if (!order) {
      return err({ code: "ORDER_NOT_FOUND", message: "El pedido no existe." });
    }
    return ok(presentCustomerOrderDetail(order));
  } catch {
    return err({
      code: "ORDERS_UNAVAILABLE",
      message: "No pudimos cargar el pedido.",
    });
  }
}
