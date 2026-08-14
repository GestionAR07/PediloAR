import { describe, expect, it, vi } from "vitest";
import { AuthzError } from "@/server/auth/errors";
import type { MerchantOrderRecord } from "@/infrastructure/db/repositories/merchant-order-repository";
import {
  getMerchantOrder,
  groupMerchantInbox,
  listMerchantInbox,
  presentMerchantCancellation,
  presentMerchantOrder,
  presentMerchantOrderStatusLabel,
  type MerchantOrderInboxDeps,
} from "./order-inbox";

const MERCHANT_A = "11111111-1111-4111-8111-111111111111";
const MERCHANT_B = "22222222-2222-4222-8222-222222222222";
const ORDER_PICKUP_A = "809965cc-dca6-40f1-b2ad-d12a898e2b19";
const ORDER_PICKUP_RETRY = "32810c46-565a-4412-bc0a-f5597b9bf794";
const ORDER_DELIVERY_A = "bb21bf5a-edef-4050-8794-f06bb2b90488";
const ORDER_B = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const TERMINAL_SINCE = new Date("2026-08-14T03:00:00.000Z");

function record(
  merchantId: string,
  overrides: Partial<MerchantOrderRecord> & Pick<MerchantOrderRecord, "id">,
): { merchantId: string; record: MerchantOrderRecord } {
  return {
    merchantId,
    record: {
      createdAt: new Date("2026-08-14T13:00:00.000Z"),
      status: "PENDING",
      fulfillmentMethod: "PICKUP",
      customerNameSnapshot: "Elias",
      customerPhoneSnapshot: "2804123456",
      orderSubtotalCents: 150000,
      deliveryFeeCents: 0,
      totalCents: 150000,
      paymentMethodCode: "CASH",
      paymentMethodLabel: "Efectivo",
      paymentMethodInstructions: "Pagar al retirar",
      canceledBy: null,
      cancelReason: null,
      items: [
        {
          id: `${overrides.id}-item`,
          productNameSnapshot: "Coca Cola",
          quantity: 1,
          unitPriceCents: 150000,
          lineTotalCents: 150000,
          itemNotes: "",
          options: [
            {
              groupNameSnapshot: "Presentación",
              choiceNameSnapshot: "475cc",
              priceDeltaCents: 0,
              quantity: 1,
            },
          ],
        },
      ],
      delivery: null,
      ...overrides,
    },
  };
}

function memoryStore(
  rows: Array<{ merchantId: string; record: MerchantOrderRecord }>,
  access: MerchantOrderInboxDeps["requireMerchantOrderAccess"] = vi.fn(
    async () => undefined,
  ),
): MerchantOrderInboxDeps {
  return {
    requireMerchantOrderAccess: access,
    listOrdersForMerchant: vi.fn(async (merchantId) =>
      rows
        .filter((row) => row.merchantId === merchantId)
        .map((row) => row.record),
    ),
    findOrderForMerchant: vi.fn(
      async (merchantId, orderId) =>
        rows.find(
          (row) => row.merchantId === merchantId && row.record.id === orderId,
        )?.record ?? null,
    ),
  };
}

describe("merchant order inbox scoping", () => {
  const rows = [
    record(MERCHANT_A, { id: ORDER_PICKUP_A }),
    record(MERCHANT_A, { id: ORDER_DELIVERY_A }),
    record(MERCHANT_B, { id: ORDER_B, customerNameSnapshot: "Otro" }),
  ];

  it("lets merchant A see only its orders", async () => {
    const deps = memoryStore(rows);
    const result = await listMerchantInbox(MERCHANT_A, TERMINAL_SINCE, deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = [
      ...result.value.attention,
      ...result.value.preparing,
      ...result.value.ready,
      ...result.value.today,
    ].map((order) => order.orderId);
    expect(ids).toEqual([ORDER_PICKUP_A, ORDER_DELIVERY_A]);
    expect(ids).not.toContain(ORDER_B);
    expect(deps.listOrdersForMerchant).toHaveBeenCalledWith(
      MERCHANT_A,
      TERMINAL_SINCE,
    );
  });

  it("does not let merchant B see merchant A orders", async () => {
    const deps = memoryStore(rows);
    const listed = await listMerchantInbox(MERCHANT_B, TERMINAL_SINCE, deps);
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value.attention.map((order) => order.orderId)).toEqual([
        ORDER_B,
      ]);
    }
    const leaked = await getMerchantOrder(MERCHANT_B, ORDER_PICKUP_A, deps);
    expect(leaked.ok).toBe(false);
    if (!leaked.ok) {
      expect(leaked.error.code).toBe("ORDER_NOT_FOUND");
    }
  });
});

describe("operational grouping", () => {
  it("puts PENDING in ATENCIÓN", () => {
    const view = presentMerchantOrder(
      record(MERCHANT_A, { id: ORDER_PICKUP_A }).record,
    );
    expect(groupMerchantInbox([view]).attention).toHaveLength(1);
    expect(view.statusLabel).toBe("Nuevo");
  });

  it("puts ACCEPTED and PREPARING in EN PREPARACIÓN", () => {
    const accepted = presentMerchantOrder(
      record(MERCHANT_A, { id: ORDER_PICKUP_A, status: "ACCEPTED" }).record,
    );
    const preparing = presentMerchantOrder(
      record(MERCHANT_A, { id: ORDER_PICKUP_RETRY, status: "PREPARING" })
        .record,
    );
    const grouped = groupMerchantInbox([accepted, preparing]);
    expect(grouped.preparing.map((order) => order.status)).toEqual([
      "ACCEPTED",
      "PREPARING",
    ]);
    expect(accepted.statusLabel).toBe("Aceptado");
    expect(preparing.statusLabel).toBe("Preparando");
  });

  it("puts READY in LISTOS", () => {
    const view = presentMerchantOrder(
      record(MERCHANT_A, { id: ORDER_PICKUP_A, status: "READY" }).record,
    );
    expect(groupMerchantInbox([view]).ready).toHaveLength(1);
    expect(view.statusLabel).toBe("Listo");
  });

  it("presents READY + delivery IN_TRANSIT as En camino in LISTOS", () => {
    const view = presentMerchantOrder(
      record(MERCHANT_A, {
        id: ORDER_DELIVERY_A,
        status: "READY",
        fulfillmentMethod: "MERCHANT_DELIVERY",
        delivery: {
          status: "IN_TRANSIT",
          zoneNameSnapshot: "Playa Unión",
          cityNameSnapshot: "Rawson",
          street: "Calle prueba",
          number: "123",
          floorApartment: null,
          reference: "Casa de prueba",
          estimatedMinutes: 30,
        },
      }).record,
    );
    expect(view.statusLabel).toBe("En camino");
    expect(groupMerchantInbox([view]).ready).toHaveLength(1);
    expect(groupMerchantInbox([view]).attention).toHaveLength(0);
  });

  it("puts COMPLETED in HOY", () => {
    const view = presentMerchantOrder(
      record(MERCHANT_A, { id: ORDER_PICKUP_A, status: "COMPLETED" }).record,
    );
    expect(groupMerchantInbox([view]).today).toHaveLength(1);
    expect(view.statusLabel).toBe("Completado");
  });

  it("puts CANCELED in HOY", () => {
    const view = presentMerchantOrder(
      record(MERCHANT_A, {
        id: ORDER_PICKUP_A,
        status: "CANCELED",
        canceledBy: "CUSTOMER",
        cancelReason: "CUSTOMER_REQUEST",
      }).record,
    );
    expect(groupMerchantInbox([view]).today).toHaveLength(1);
  });
});

describe("cancellation presentation", () => {
  it("shows merchant rejection copy", () => {
    const cancellation = presentMerchantCancellation(
      "MERCHANT_USER",
      "OUT_OF_STOCK",
    );
    expect(cancellation?.headline).toBe("Rechazado por el comercio");
    expect(cancellation?.detail).toBe("Sin stock");
    const view = presentMerchantOrder(
      record(MERCHANT_A, {
        id: ORDER_PICKUP_A,
        status: "CANCELED",
        canceledBy: "MERCHANT_USER",
        cancelReason: "OUT_OF_STOCK",
      }).record,
    );
    expect(view.statusLabel).toBe("Rechazado por el comercio");
  });

  it("shows customer cancellation copy", () => {
    const cancellation = presentMerchantCancellation(
      "CUSTOMER",
      "CUSTOMER_REQUEST",
    );
    expect(cancellation?.headline).toBe("Cancelado por el cliente");
    expect(presentMerchantCancellation("ADMIN", "OTHER")?.headline).toBe(
      "Cancelado",
    );
    expect(
      presentMerchantCancellation("SYSTEM", "PAYMENT_ISSUE")?.headline,
    ).toBe("Cancelado");
  });
});

describe("pickup and merchant delivery presentation", () => {
  it("omits Delivery for PICKUP", () => {
    const view = presentMerchantOrder(
      record(MERCHANT_A, { id: ORDER_PICKUP_A }).record,
    );
    expect(view.fulfillmentMethod).toBe("PICKUP");
    expect(view.fulfillmentLabel).toBe("Retiro");
    expect(view.delivery).toBeNull();
  });

  it("shows merchant delivery address snapshots", () => {
    const view = presentMerchantOrder(
      record(MERCHANT_A, {
        id: ORDER_DELIVERY_A,
        fulfillmentMethod: "MERCHANT_DELIVERY",
        orderSubtotalCents: 150000,
        deliveryFeeCents: 100000,
        totalCents: 250000,
        delivery: {
          status: "PENDING",
          zoneNameSnapshot: "Playa Unión",
          cityNameSnapshot: "Rawson",
          street: "Calle prueba",
          number: "123",
          floorApartment: null,
          reference: "Casa de prueba",
          estimatedMinutes: 40,
        },
      }).record,
    );
    expect(view.fulfillmentLabel).toBe("Envío");
    expect(view.delivery).toMatchObject({
      status: "PENDING",
      statusLabel: "Pendiente",
      zoneName: "Playa Unión",
      cityName: "Rawson",
      street: "Calle prueba",
      number: "123",
      reference: "Casa de prueba",
      estimatedMinutes: 40,
    });
  });

  it("uses option and payment snapshots", () => {
    const view = presentMerchantOrder(
      record(MERCHANT_A, { id: ORDER_PICKUP_A }).record,
    );
    expect(view.items[0]?.options).toEqual([
      {
        groupName: "Presentación",
        choiceName: "475cc",
        priceDeltaCents: 0,
        quantity: 1,
      },
    ]);
    expect(view.payment).toEqual({
      code: "CASH",
      label: "Efectivo",
      instructions: "Pagar al retirar",
    });
  });

  it("keeps MoneyCents as integers and reuses shortRef", () => {
    const view = presentMerchantOrder(
      record(MERCHANT_A, {
        id: ORDER_DELIVERY_A,
        totalCents: 250000,
        deliveryFeeCents: 100000,
      }).record,
    );
    expect(view.shortRef).toBe("BB21BF5A");
    expect(
      presentMerchantOrder(record(MERCHANT_A, { id: ORDER_PICKUP_A }).record)
        .shortRef,
    ).toBe("809965CC");
    expect(
      presentMerchantOrder(
        record(MERCHANT_A, { id: ORDER_PICKUP_RETRY }).record,
      ).shortRef,
    ).toBe("32810C46");
    expect(Number.isInteger(view.money.totalCents)).toBe(true);
    expect(view.money.totalCents).toBe(250000);
    expect(view.money.deliveryFeeCents).toBe(100000);
  });

  it("does not expose idempotency or internal fields", () => {
    const view = presentMerchantOrder(
      record(MERCHANT_A, { id: ORDER_PICKUP_A }).record,
    );
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("idempotency");
    expect(serialized).not.toContain("customerUserId");
    expect(serialized).not.toContain("customer_user_id");
    expect(view).not.toHaveProperty("idempotencyKey");
    expect(view).not.toHaveProperty("customerUserId");
  });
});

describe("merchant order inbox authorization", () => {
  it("allows OWNER", async () => {
    const deps = memoryStore([record(MERCHANT_A, { id: ORDER_PICKUP_A })]);
    const result = await listMerchantInbox(MERCHANT_A, TERMINAL_SINCE, deps);
    expect(result.ok).toBe(true);
    expect(deps.requireMerchantOrderAccess).toHaveBeenCalledWith(MERCHANT_A);
  });

  it("allows STAFF through the same OWNER|STAFF gate", async () => {
    const deps = memoryStore([record(MERCHANT_A, { id: ORDER_PICKUP_A })]);
    const result = await getMerchantOrder(MERCHANT_A, ORDER_PICKUP_A, deps);
    expect(result.ok).toBe(true);
    expect(deps.requireMerchantOrderAccess).toHaveBeenCalledWith(MERCHANT_A);
  });

  it("denies ADMIN without membership", async () => {
    const deps = memoryStore(
      [record(MERCHANT_A, { id: ORDER_PICKUP_A })],
      vi.fn(async () => {
        throw new AuthzError("NOT_MERCHANT_MEMBER", "no");
      }),
    );
    await expect(
      listMerchantInbox(MERCHANT_A, TERMINAL_SINCE, deps),
    ).rejects.toMatchObject({ code: "NOT_MERCHANT_MEMBER" });
    expect(deps.listOrdersForMerchant).not.toHaveBeenCalled();
  });

  it("returns an empty inbox without looking broken", async () => {
    const deps = memoryStore([]);
    const result = await listMerchantInbox(MERCHANT_A, TERMINAL_SINCE, deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      attention: [],
      preparing: [],
      ready: [],
      today: [],
    });
  });

  it("hides SQL when the query fails", async () => {
    const deps = memoryStore([]);
    deps.listOrdersForMerchant = vi.fn(async () => {
      throw new Error("relation orders does not exist");
    });
    const result = await listMerchantInbox(MERCHANT_A, TERMINAL_SINCE, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("No pudimos cargar los pedidos.");
      expect(result.error.message).not.toContain("relation");
    }
  });
});

describe("status labels", () => {
  it("maps operational labels", () => {
    expect(
      presentMerchantOrderStatusLabel({
        status: "PENDING",
        deliveryStatus: null,
      }),
    ).toBe("Nuevo");
    expect(
      presentMerchantOrderStatusLabel({
        status: "READY",
        deliveryStatus: "IN_TRANSIT",
      }),
    ).toBe("En camino");
  });
});
