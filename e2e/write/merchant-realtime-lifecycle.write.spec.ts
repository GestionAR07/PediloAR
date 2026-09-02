import type { BrowserContext, Page, WebSocket } from "@playwright/test";
import { createGuardedBrowserContext, expect, test } from "../fixtures";
import { E2E_WRITE_DEV_MODE } from "../lib/dev-write-guard";
import {
  createDevBuyerFixture,
  type DevBuyerFixture,
} from "../lib/dev-buyer-fixture";
import {
  createDevMerchantOperatorFixture,
  type DevMerchantOperatorFixture,
} from "../lib/dev-merchant-operator-fixture";

function shortOrderReference(orderId: string): string {
  return orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function waitForMerchantRealtimeJoin(
  page: Page,
  merchantId: string,
): Promise<void> {
  const topic = `merchant-orders:${merchantId}`;

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      page.off("websocket", onWebSocket);
      reject(
        new Error(
          `Merchant Realtime E2E: private topic ${topic} was not joined in time.`,
        ),
      );
    }, 15_000);

    const finish = () => {
      clearTimeout(timeoutId);
      page.off("websocket", onWebSocket);
      resolve();
    };

    const onWebSocket = (socket: WebSocket) => {
      if (!socket.url().includes("/realtime/v1/websocket")) {
        return;
      }
      socket.on("framesent", (frame) => {
        const payload = String(frame.payload);
        if (payload.includes(topic)) {
          finish();
        }
      });
    };

    page.on("websocket", onWebSocket);
  });
}

async function loginMerchant(
  page: Page,
  fixture: DevBuyerFixture,
  operator: DevMerchantOperatorFixture,
): Promise<void> {
  const merchantHref = `/merchant/${fixture.merchant.id}`;
  const realtimeJoin = waitForMerchantRealtimeJoin(page, fixture.merchant.id);

  await page.goto(`/login?next=${encodeURIComponent(merchantHref)}`);
  await page.getByLabel("Email").fill(operator.email);
  await page.getByLabel("Contraseña").fill(operator.password);
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(page).toHaveURL(
    new RegExp(`/merchant/${fixture.merchant.id}(?:\\?.*)?$`),
  );
  await expect(
    page.getByRole("heading", { name: fixture.merchant.name }),
  ).toBeVisible();
  await realtimeJoin;
  await page.waitForTimeout(500);
}

async function placeBuyerPickupOrder(
  page: Page,
  fixture: DevBuyerFixture,
): Promise<string> {
  const storefrontHref = `/comercios/${fixture.merchant.id}`;
  await page.goto(`/login?next=${encodeURIComponent(storefrontHref)}`);
  await page.getByLabel("Email").fill(fixture.buyer.email);
  await page.getByLabel("Contraseña").fill(fixture.buyer.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/comercios/${fixture.merchant.id}(?:\\?.*)?$`),
  );

  await page.getByLabel("Buscar en este comercio").fill(fixture.product.name);
  const productCard = page
    .locator("article")
    .filter({ hasText: fixture.product.name });
  await expect(productCard).toHaveCount(1);
  await productCard.getByRole("button", { name: "Agregar" }).click();
  await expect(page.getByRole("status")).toContainText("Agregado al carrito");

  await page.goto("/carrito");
  await page.getByRole("link", { name: "Continuar" }).click();
  await expect(
    page.getByRole("heading", { name: "Finalizá tu pedido" }),
  ).toBeVisible();

  const pickup = page.locator(
    'input[name="fulfillmentMethod"][value="PICKUP"]',
  );
  await expect(pickup).toBeVisible();
  await pickup.check();

  const payment = page.locator(
    `input[name="paymentMethodCode"][value="${fixture.paymentMethodCode}"]`,
  );
  await expect(payment).toBeVisible();
  await payment.check();

  const review = page.getByRole("button", { name: "Revisar pedido" });
  await expect(review).toBeEnabled();
  await review.click();
  await expect(
    page.getByText("Pedido revisado", { exact: true }),
  ).toBeVisible();

  const confirm = page
    .locator(".checkout-review-panel")
    .getByRole("button", { name: "Confirmar pedido" });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(
    page.getByRole("heading", { name: "Pedido recibido" }),
  ).toBeVisible({ timeout: 15_000 });

  const trackingLink = page.getByRole("link", { name: "Seguir mi pedido" });
  const href = await trackingLink.getAttribute("href");
  const match = href?.match(/^\/cuenta\/pedidos\/([0-9a-f-]{36})$/i);
  expect(match, "buyer success must expose the exact order id").toBeTruthy();
  return match![1]!;
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

test.describe("WRITE_DEV merchant Realtime and pickup lifecycle", () => {
  test("merchant receives a real buyer order and completes the pickup lifecycle", async ({
    browser,
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    expect(process.env.E2E_MODE).toBe(E2E_WRITE_DEV_MODE);
    if (!baseURL) {
      throw new Error("Merchant Realtime E2E: Playwright baseURL is required.");
    }

    const fixture = await createDevBuyerFixture({
      productLabel: "Merchant Realtime lifecycle product",
      stock: 5,
    });
    let operator: DevMerchantOperatorFixture | null = null;
    let buyerContext: BrowserContext | null = null;

    try {
      operator = await createDevMerchantOperatorFixture({
        sql: fixture.sql,
        merchantId: fixture.merchant.id,
      });
      await loginMerchant(page, fixture, operator);

      buyerContext = await createGuardedBrowserContext({ browser, baseURL });
      const buyerPage = await buyerContext.newPage();
      const orderId = await placeBuyerPickupOrder(buyerPage, fixture);
      fixture.registerOrder(orderId);
      const shortRef = shortOrderReference(orderId);

      const toast = page
        .locator("article.merchant-order-toast")
        .filter({ hasText: `Pedido #${shortRef}` });
      await expect(toast).toBeVisible({ timeout: 15_000 });
      await expect(toast).toContainText("NUEVO PEDIDO");
      await expect(toast).toContainText(
        "Tenés un nuevo pedido para revisar.",
      );

      await toast.getByRole("link", { name: "Ver pedido" }).click();
      await expect(page).toHaveURL(
        new RegExp(
          `/merchant/${fixture.merchant.id}/orders/${orderId}(?:\\?.*)?$`,
        ),
      );
      await expect(
        page.getByRole("heading", { name: `Pedido #${shortRef}` }),
      ).toBeVisible();
      await expect(page.getByText(fixture.product.name)).toBeVisible();

      const accept = page.getByRole("button", { name: "Aceptar" });
      await expect(accept).toBeEnabled();
      await accept.click();
      await expectOrderStatus(fixture, orderId, "ACCEPTED");
      const prepare = page.getByRole("button", {
        name: "Comenzar preparación",
      });
      await expect(prepare).toBeEnabled();

      await prepare.click();
      await expectOrderStatus(fixture, orderId, "PREPARING");
      const ready = page.getByRole("button", { name: "Marcar listo" });
      await expect(ready).toBeEnabled();

      await ready.click();
      await expectOrderStatus(fixture, orderId, "READY");
      const complete = page.getByRole("button", { name: "Marcar retirado" });
      await expect(complete).toBeEnabled();

      await complete.click();
      await expectOrderStatus(fixture, orderId, "COMPLETED");

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
        expect(event.actor_type).toBe("MERCHANT");
        expect(event.actor_id).toBe(operator.userId);
      }

      const [stock] = await fixture.sql<{ stock_quantity: number | null }[]>`
        select stock_quantity
        from products
        where id = ${fixture.product.id}
      `;
      expect(stock?.stock_quantity).toBe(4);
    } finally {
      await buyerContext?.close();
      try {
        if (operator) {
          await operator.cleanup();
        }
      } finally {
        await fixture.cleanup();
      }
    }
  });
});
