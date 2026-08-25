import { describe, expect, it, vi } from "vitest";
import type {
  CustomerOrderDetailRecord,
  CustomerOrderSummaryRecord,
} from "@/infrastructure/db/repositories/customer-order-repository";
import {
  getCustomerOrder,
  listCustomerOrders,
  presentCustomerOrderDetail,
  presentCustomerStatus,
  type CustomerOrderDeps,
} from "./order-history";

const CUSTOMER_ID = "12121212-1212-4212-8212-121212121212";
const ORDER_ID = "23232323-2323-4323-8323-232323232323";
const NOW = new Date("2026-08-25T18:00:00.000Z");

function summary(
  overrides: Partial<CustomerOrderSummaryRecord> = {},
): CustomerOrderSummaryRecord {
  return {
    id: ORDER_ID,
    merchantNameSnapshot: "Empanadas Rawson",
    status: "PREPARING",
    fulfillmentMethod: "MERCHANT_DELIVERY",
    totalCents: 125000,
    deliveryStatus: "PENDING",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function detail(
  overrides: Partial<CustomerOrderDetailRecord> = {},
): CustomerOrderDetailRecord {
  return {
    ...summary(),
    customerNameSnapshot: "Ana López",
    customerPhoneSnapshot: "2804123456",
    orderSubtotalCents: 110000,
    deliveryFeeCents: 15000,
    paymentMethodLabel: "Efectivo",
    paymentMethodInstructions: "Pagá al recibir",
    deliveryAddress: {
      cityName: "Rawson",
      zoneName: "Centro",
      street: "San Martín",
      number: "123",
      floorApartment: null,
      reference: "Portón azul",
      estimatedMinutes: 40,
    },
    canceledBy: null,
    cancelReason: null,
    items: [
      {
        id: "34343434-3434-4434-8434-343434343434",
        productNameSnapshot: "Docena de empanadas",
        unitPriceCents: 110000,
        quantity: 1,
        lineTotalCents: 110000,
        options: [],
      },
    ],
    events: [
      {
        fromStatus: null,
        toStatus: "PENDING",
        reason: null,
        createdAt: NOW,
      },
      {
        fromStatus: "ACCEPTED",
        toStatus: "PREPARING",
        reason: null,
        createdAt: new Date("2026-08-25T18:05:00.000Z"),
      },
    ],
    ...overrides,
  };
}

function deps(overrides: Partial<CustomerOrderDeps> = {}): CustomerOrderDeps {
  return {
    listOrdersForCustomer: vi.fn(async () => []),
    findOrderForCustomer: vi.fn(async () => null),
    ...overrides,
  };
}

describe("customer order history", () => {
  it("groups active and terminal orders", async () => {
    const result = await listCustomerOrders(
      CUSTOMER_ID,
      deps({
        listOrdersForCustomer: vi.fn(async () => [
          summary(),
          summary({ id: crypto.randomUUID(), status: "COMPLETED" }),
        ]),
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.active).toHaveLength(1);
    expect(result.value.history).toHaveLength(1);
  });

  it("uses customer-facing status copy for delivery in transit", () => {
    expect(
      presentCustomerStatus({
        status: "READY",
        fulfillmentMethod: "MERCHANT_DELIVERY",
        deliveryStatus: "IN_TRANSIT",
      }),
    ).toEqual({
      label: "En camino",
      detail: "Tu pedido está viajando hacia vos.",
    });
  });

  it("presents snapshots and timeline without actor ids", () => {
    const view = presentCustomerOrderDetail(detail());
    expect(view.orderRef).toBe("23232323");
    expect(view.delivery?.addressLabel).toContain("San Martín 123");
    expect(view.timeline.map((event) => event.label)).toEqual([
      "Esperando confirmación",
      "En preparación",
    ]);
    expect(JSON.stringify(view)).not.toContain("actorId");
    expect(JSON.stringify(view)).not.toContain("customerUserId");
  });

  it("passes both customer and order ids to the secure repository lookup", async () => {
    const findOrderForCustomer = vi.fn(async () => detail());
    const result = await getCustomerOrder(
      CUSTOMER_ID,
      ORDER_ID,
      deps({ findOrderForCustomer }),
    );
    expect(result.ok).toBe(true);
    expect(findOrderForCustomer).toHaveBeenCalledWith(CUSTOMER_ID, ORDER_ID);
  });

  it("returns not found for invalid or foreign order ids", async () => {
    const repository = deps();
    const invalid = await getCustomerOrder(
      CUSTOMER_ID,
      "not-a-uuid",
      repository,
    );
    expect(invalid.ok).toBe(false);
    expect(repository.findOrderForCustomer).not.toHaveBeenCalled();

    const foreign = await getCustomerOrder(CUSTOMER_ID, ORDER_ID, repository);
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect(foreign.error.code).toBe("ORDER_NOT_FOUND");
  });
});
