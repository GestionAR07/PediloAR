import { randomUUID } from "node:crypto";
import type { BrowserContext, Page } from "@playwright/test";
import type { Sql } from "postgres";
import { createGuardedBrowserContext, expect, test } from "../fixtures";
import {
  createDevBuyerFixture,
  type DevBuyerFixture,
} from "../lib/dev-buyer-fixture";
import {
  createDevMerchantOperatorFixture,
  type DevMerchantOperatorFixture,
} from "../lib/dev-merchant-operator-fixture";
import { E2E_WRITE_DEV_MODE } from "../lib/dev-write-guard";

const PUBLIC_ZONE_STORAGE_KEY = "mr.public.zoneId";

type DeliveryZoneRow = {
  zone_id: string;
  minimum_order_cents: string | number | bigint;
  fee_cents: string | number | bigint;
};

type IsolationMerchant = {
  id: string;
  name: string;
  cleanup(): Promise<void>;
};

function shortOrderReference(orderId: string): string {
  return orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function centsFromPg(value: string | number | bigint): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("Merchant E2E: invalid money cents returned from PostgreSQL.");
  }
  return parsed;
}

async function createIsolationMerchant(
  sql: Sql,
  sourceMerchantId: string,
): Promise<IsolationMerchant> {
  const runId = randomUUID().replace(/-/g, "");
  const name = `[E2E:${runId}] Isolation merchant`;
  const slug = `e2e-isolation-${runId}`;
  const [source] = await sql<{ city_id: string; zone_id: string }[]>`
    select city_id, zone_id
    from merchants
    where id = ${sourceMerchantId}
  `;
  if (!source) {
    throw new Error("Merchant E2E: source merchant disappeared during setup.");
  }

  const [created] = await sql<{ id: string }[]>`
    insert into merchants (
      city_id,
      zone_id,
      name,
      slug,
      description,
      status,
      pickup_enabled,
      merchant_delivery_enabled,
      platform_delivery_enabled,
      accepting_orders
    ) values (
      ${source.city_id},
      ${source.zone_id},
      ${name},
      ${slug},
      ${"Run-scoped cross-merchant E2E isolation target."},
      'DRAFT',
      false,
      false,
      false,
      false
    )
    returning id
  `;
  if (!created) {
    throw new Error("Merchant E2E: isolation merchant creation failed.");
  }

  let cleaned = false;
  return {
    id: created.id,
    name,
    async cleanup(): Promise<void> {
      if (cleaned) return;
      await sql`delete from merchants where id = ${created.id}`;
      const rows = await sql<{ id: string }[]>`
        select id from merchants where id = ${created.id}
      `;
      if (rows.length !== 0) {
        throw new Error(
          "Merchant E2E: isolation merchant cleanup verification failed.",
        );
      }
      cleaned = true;
    },
  };
}

async function requireActiveDeliveryZone(
  fixture: DevBuyerFixture,
): Promise<DeliveryZoneRow> {
  const rows = await fixture.sql<DeliveryZoneRow[]>`
    select
      mdz.zone_id,
      mdz.minimum_order_cents,
      mdz.delivery_fee_cents as fee_cents
    from merchant_delivery_zones mdz
    join merchants m on m.id = mdz.merchant_id
    where mdz.merchant_id = ${fixture.merchant.id}
      and mdz.active = true
      and m.merchant_delivery_enabled = true
    order by mdz.id
    limit 1
  `;
  if (!rows[0]) {
    throw new Error(
      "Merchant delivery E2E: Comercio Prueba needs merchant delivery enabled and at least one active delivery zone in DEV.",
    );
  }
  return rows[0];
}

async function ensureProductMeetsDeliveryMinimum(
  fixture: DevBuyerFixture,
  deliveryZone: DeliveryZoneRow,
): Promise<void> {
  const minimum = centsFromPg(deliveryZone.minimum_order_cents);
  const requiredPrice = Math.max(fixture.product.priceCents, minimum + 10_000);
  if (requiredPrice === fixture.product.priceCents) return;

  await fixture.sql`
    update products
    set price_cents = ${requiredPrice}, updated_at = now()
    where id = ${fixture.product.id}
  `;
}

async function login(
  page: Page,
  email: string,
  password: string,
  nextHref: string,
): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(nextHref)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(new RegExp(`${nextHref.replaceAll("/", "\\/")}(?:\\?.*)?$`));
}

async function loginBuyerAndAddProduct(
  page: Page,
  fixture: DevBuyerFixture,
): Promise<void> {
  const storefrontHref = `/comercios/${fixture.merchant.id}`;
  await login(page, fixture.buyer.email, fixture.buyer.password, storefrontHref);

  await page.getByLabel("Buscar en este comercio").fill(fixture.product.name);
  const productCard = page
    .locator("article")
    .filter({ hasText: fixture.product.name });
  await expect(productCard).toHaveCount(1);
  await productCard.getByRole("button", { name: "Agregar" }).click();
  await expect(page.getByRole("status")).toContainText("Agregado al carrito");
}

async function openCheckout(page: Page): Promise<void> {
  await page.goto("/carrito");
  await page.getByRole("link", { name: "Continuar" }).click();
  await expect(
    page.getByRole("heading", { name: "Finalizá tu pedido" }),
  ).toBeVisible();
}

async function choosePayment(
  page: Page,
  fixture: DevBuyerFixture,
): Promise<void> {
  const payment = page.locator(
    `input[name="paymentMethodCode"][value="${fixture.paymentMethodCode}"]`,
  );
  await expect(payment).toBeVisible();
  await payment.check();
}

async function reviewAndPlaceOrder(
  page: Page,
  fixture: DevBuyerFixture,
): Promise<string> {
  const review = page.getByRole("button", { name: "Revisar pedido" });
  await expect(review).toBeEnabled();
  await review.click();
  await expect(page.getByText("Pedido revisado", { exact: true })).toBeVisible();

  const confirm = page
    .locator(".checkout-review-panel")
    .getByRole("button", { name: "Confirmar pedido" });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(
    page.getByRole("heading", { name: "Pedido recibido" }),
  ).toBeVisible({ timeout: 15_000 });

  const href = await page
    .getByRole("link", { name: "Seguir mi pedido" })
    .getAttribute("href");
  const match = href?.match(/^\/cuenta\/pedidos\/([0-9a-f-]{36})$/i);
  expect(match, "buyer success must expose the exact order id").toBeTruthy();
  const orderId = match![1]!;
  fixture.registerOrder(orderId);
  return orderId;
}

async function placePickupOrder(
  page: Page,
  fixture: DevBuyerFixture,
): Promise<string> {
  await loginBuyerAndAddProduct(page, fixture);
  await openCheckout(page);

  const pickup = page.locator(
    'input[name="fulfillmentMethod"][value="PICKUP"]',
  );
  await expect(pickup).toBeVisible();
  await pickup.check();
  await choosePayment(page, fixture);
  return reviewAndPlaceOrder(page, fixture);
}

async function placeMerchantDeliveryOrder(
  page: Page,
  fixture: DevBuyerFixture,
  deliveryZone: DeliveryZoneRow,
): Promise<string> {
  await loginBuyerAndAddProduct(page, fixture);
  await page.evaluate(
    ({ key, zoneId }) => window.localStorage.setItem(key, zoneId),
    { key: PUBLIC_ZONE_STORAGE_KEY, zoneId: deliveryZone.zone_id },
  );
  await openCheckout(page);

  const delivery = page.locator(
    'input[name="fulfillmentMethod"][value="MERCHANT_DELIVERY"]',
  );
  await expect(delivery).toBeVisible();
  await delivery.check();

  await page.locator('select[name="deliveryZoneId"]').selectOption(deliveryZone.zone_id);
  await page.getByLabel("Calle").fill("E2E Avenida Siempre Viva");
  await page.getByLabel("Número").fill("742");
  await page.getByLabel("Piso / depto (opcional)").fill("2 B");
  await page.getByLabel("Referencia (opcional)").fill("Puerta violeta E2E");
  await choosePayment(page, fixture);
  return reviewAndPlaceOrder(page, fixture);
}

async function loginMerchant(
  page: Page,
  merchantId: string,
  operator: DevMerchantOperatorFixture,
): Promise<void> {
  const merchantHref = `/merchant/${merchantId}`;
  await login(page, operator.email, operator.password, merchantHref);
}

async function expectOrderStatus(
  fixture: DevBuyerFixture,
  orderId: string,
  expectedStatus: string,
): Promise<void> {
  await expect
    .poll(async () => {
      const [row] = await fixture.sql<{ status: string }[]>`
        select status from orders where id = ${orderId}
      `;
      return row?.status ?? null;
    })
    .toBe(expectedStatus);
}

async function expectDeliveryStatus(
  fixture: DevBuyerFixture,
  orderId: string,
  expectedStatus: string,
): Promise<void> {
  await expect
    .poll(async () => {
      const [row] = await fixture.sql<{ status: string }[]>`
        select status from deliveries where order_id = ${orderId}
      `;
      return row?.status ?? null;
    })
    .toBe(expectedStatus);
}

async function expectProductStock(
  fixture: DevBuyerFixture,
  expectedStock: number,
): Promise<void> {
  await expect
    .poll(async () => {
      const [row] = await fixture.sql<{ stock_quantity: number | null }[]>`
        select stock_quantity from products where id = ${fixture.product.id}
      `;
      return row?.stock_quantity ?? null;
    })
    .toBe(expectedStock);
}

async function openMerchantOrder(
  page: Page,
  merchantId: string,
  orderId: string,
): Promise<void> {
  await page.goto(`/merchant/${merchantId}/orders/${orderId}`);
  await expect(
    page.getByRole("heading", { name: `Pedido #${shortOrderReference(orderId)}` }),
  ).toBeVisible();
}

async function advanceOrderToReady(
  page: Page,
  fixture: DevBuyerFixture,
  orderId: string,
): Promise<void> {
  await page.getByRole("button", { name: "Aceptar" }).click();
  await expectOrderStatus(fixture, orderId, "ACCEPTED");

  await page.getByRole("button", { name: "Comenzar preparación" }).click();
  await expectOrderStatus(fixture, orderId, "PREPARING");

  await page.getByRole("button", { name: "Marcar listo" }).click();
  await expectOrderStatus(fixture, orderId, "READY");
}

async function closeContext(context: BrowserContext | null): Promise<void> {
  if (context) await context.close();
}

test.describe("WRITE_DEV merchant delivery, rejection and isolation", () => {
  test("merchant delivery reaches IN_TRANSIT then DELIVERED without double stock decrement", async ({
    browser,
    page,
    baseURL,
  }) => {
    test.setTimeout(150_000);
    expect(process.env.E2E_MODE).toBe(E2E_WRITE_DEV_MODE);
    if (!baseURL) throw new Error("Merchant delivery E2E: baseURL is required.");

    const fixture = await createDevBuyerFixture({
      productLabel: "Merchant delivery lifecycle product",
      stock: 5,
    });
    let operator: DevMerchantOperatorFixture | null = null;
    let merchantContext: BrowserContext | null = null;

    try {
      const deliveryZone = await requireActiveDeliveryZone(fixture);
      await ensureProductMeetsDeliveryMinimum(fixture, deliveryZone);
      operator = await createDevMerchantOperatorFixture({
        sql: fixture.sql,
        merchantId: fixture.merchant.id,
      });

      const orderId = await placeMerchantDeliveryOrder(page, fixture, deliveryZone);
      await expectOrderStatus(fixture, orderId, "PENDING");
      await expectDeliveryStatus(fixture, orderId, "PENDING");
      await expectProductStock(fixture, 4);

      const [deliveryRow] = await fixture.sql<
        {
          provider: string;
          address_zone_id: string | null;
          address_street: string;
          address_number: string;
        }[]
      >`
        select provider, address_zone_id, address_street, address_number
        from deliveries
        where order_id = ${orderId}
      `;
      expect(deliveryRow).toMatchObject({
        provider: "MERCHANT",
        address_zone_id: deliveryZone.zone_id,
        address_street: "E2E Avenida Siempre Viva",
        address_number: "742",
      });

      merchantContext = await createGuardedBrowserContext({ browser, baseURL });
      const merchantPage = await merchantContext.newPage();
      await loginMerchant(merchantPage, fixture.merchant.id, operator);
      await openMerchantOrder(merchantPage, fixture.merchant.id, orderId);
      await advanceOrderToReady(merchantPage, fixture, orderId);
      await expectDeliveryStatus(fixture, orderId, "PENDING");

      await merchantPage.getByRole("button", { name: "Marcar en camino" }).click();
      await expectOrderStatus(fixture, orderId, "READY");
      await expectDeliveryStatus(fixture, orderId, "IN_TRANSIT");
      await expectProductStock(fixture, 4);

      await merchantPage.getByRole("button", { name: "Marcar entregado" }).click();
      await expectOrderStatus(fixture, orderId, "COMPLETED");
      await expectDeliveryStatus(fixture, orderId, "DELIVERED");
      await expectProductStock(fixture, 4);

      const events = await fixture.sql<
        { to_status: string; actor_type: string; actor_id: string | null }[]
      >`
        select to_status, actor_type, actor_id
        from order_events
        where order_id = ${orderId}
        order by created_at, id
      `;
      expect(events.map((event) => event.to_status)).toEqual([
        "PENDING",
        "ACCEPTED",
        "PREPARING",
        "READY",
        "COMPLETED",
      ]);
      expect(events[0]?.actor_type).toBe("CUSTOMER");
      for (const event of events.slice(1)) {
        expect(event.actor_type).toBe("MERCHANT_USER");
        expect(event.actor_id).toBe(operator.userId);
      }
    } finally {
      await closeContext(merchantContext);
      try {
        if (operator) await operator.cleanup();
      } finally {
        await fixture.cleanup();
      }
    }
  });

  test("merchant rejection cancels a pending order and restores TRACKED stock exactly once", async ({
    browser,
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    expect(process.env.E2E_MODE).toBe(E2E_WRITE_DEV_MODE);
    if (!baseURL) throw new Error("Merchant rejection E2E: baseURL is required.");

    const fixture = await createDevBuyerFixture({
      productLabel: "Merchant rejection restock product",
      stock: 5,
    });
    let operator: DevMerchantOperatorFixture | null = null;
    let merchantContext: BrowserContext | null = null;

    try {
      operator = await createDevMerchantOperatorFixture({
        sql: fixture.sql,
        merchantId: fixture.merchant.id,
      });
      const orderId = await placePickupOrder(page, fixture);
      await expectOrderStatus(fixture, orderId, "PENDING");
      await expectProductStock(fixture, 4);

      merchantContext = await createGuardedBrowserContext({ browser, baseURL });
      const merchantPage = await merchantContext.newPage();
      await loginMerchant(merchantPage, fixture.merchant.id, operator);
      await openMerchantOrder(merchantPage, fixture.merchant.id, orderId);

      await merchantPage.getByRole("button", { name: "Rechazar" }).click();
      const dialog = merchantPage.getByRole("dialog", { name: "Rechazar pedido" });
      await expect(dialog).toBeVisible();
      await dialog.getByLabel("Sin stock").check();
      await dialog.getByRole("button", { name: "Confirmar rechazo" }).click();

      await expectOrderStatus(fixture, orderId, "CANCELED");
      await expectProductStock(fixture, 5);
      await merchantPage.reload();
      await expectProductStock(fixture, 5);
      await expect(merchantPage.getByRole("button", { name: "Rechazar" })).toHaveCount(0);

      const [order] = await fixture.sql<
        {
          canceled_by: string | null;
          cancel_reason: string | null;
          canceled_at: Date | null;
        }[]
      >`
        select canceled_by, cancel_reason, canceled_at
        from orders
        where id = ${orderId}
      `;
      expect(order?.canceled_by).toBe("MERCHANT_USER");
      expect(order?.cancel_reason).toBe("OUT_OF_STOCK");
      expect(order?.canceled_at).not.toBeNull();

      const events = await fixture.sql<
        {
          to_status: string;
          actor_type: string;
          actor_id: string | null;
          reason: string | null;
        }[]
      >`
        select to_status, actor_type, actor_id, reason
        from order_events
        where order_id = ${orderId}
        order by created_at, id
      `;
      expect(events.map((event) => event.to_status)).toEqual([
        "PENDING",
        "CANCELED",
      ]);
      expect(events[1]).toMatchObject({
        actor_type: "MERCHANT_USER",
        actor_id: operator.userId,
        reason: "OUT_OF_STOCK",
      });
    } finally {
      await closeContext(merchantContext);
      try {
        if (operator) await operator.cleanup();
      } finally {
        await fixture.cleanup();
      }
    }
  });

  test("operator from another merchant cannot read the target merchant order", async ({
    browser,
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    expect(process.env.E2E_MODE).toBe(E2E_WRITE_DEV_MODE);
    if (!baseURL) throw new Error("Merchant isolation E2E: baseURL is required.");

    const fixture = await createDevBuyerFixture({
      productLabel: "Cross merchant isolation product",
      stock: 5,
    });
    let isolationMerchant: IsolationMerchant | null = null;
    let attacker: DevMerchantOperatorFixture | null = null;
    let attackerContext: BrowserContext | null = null;

    try {
      const orderId = await placePickupOrder(page, fixture);
      await expectOrderStatus(fixture, orderId, "PENDING");
      await expectProductStock(fixture, 4);

      isolationMerchant = await createIsolationMerchant(
        fixture.sql,
        fixture.merchant.id,
      );
      attacker = await createDevMerchantOperatorFixture({
        sql: fixture.sql,
        merchantId: isolationMerchant.id,
      });

      attackerContext = await createGuardedBrowserContext({ browser, baseURL });
      const attackerPage = await attackerContext.newPage();
      await loginMerchant(attackerPage, isolationMerchant.id, attacker);

      await attackerPage.goto(
        `/merchant/${fixture.merchant.id}/orders/${orderId}`,
      );
      await expect(attackerPage).toHaveURL(
        /\/login\?next=%2Fmerchant&error=forbidden$/,
      );
      await expectOrderStatus(fixture, orderId, "PENDING");
      await expectProductStock(fixture, 4);

      await loginMerchant(attackerPage, isolationMerchant.id, attacker);
      await attackerPage.goto(
        `/merchant/${isolationMerchant.id}/orders/${orderId}`,
      );
      await expect(attackerPage.getByText("El pedido no existe.")).toBeVisible();
      await expect(
        attackerPage.getByRole("heading", {
          name: `Pedido #${shortOrderReference(orderId)}`,
        }),
      ).toHaveCount(0);
      await expect(attackerPage.getByRole("button", { name: "Aceptar" })).toHaveCount(0);
      await expect(attackerPage.getByRole("button", { name: "Rechazar" })).toHaveCount(0);
      await expectOrderStatus(fixture, orderId, "PENDING");
      await expectProductStock(fixture, 4);
    } finally {
      await closeContext(attackerContext);
      try {
        if (attacker) await attacker.cleanup();
      } finally {
        try {
          if (isolationMerchant) await isolationMerchant.cleanup();
        } finally {
          await fixture.cleanup();
        }
      }
    }
  });
});
