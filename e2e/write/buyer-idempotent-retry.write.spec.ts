import type { Page, Route } from "@playwright/test";
import { expect, test } from "../fixtures";
import { E2E_WRITE_DEV_MODE } from "../lib/dev-write-guard";
import {
  createDevBuyerFixture,
  type DevBuyerFixture,
} from "../lib/dev-buyer-fixture";

const UNKNOWN_OUTCOME_MESSAGE =
  "No pudimos confirmar la respuesta del servidor.";

async function loginAndReviewPickupOrder(
  page: Page,
  fixture: DevBuyerFixture,
): Promise<void> {
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
  const cartLine = page
    .locator(".cart-line-card")
    .filter({ hasText: fixture.product.name });
  await expect(cartLine).toHaveCount(1);
  await page.getByRole("link", { name: "Continuar" }).click();

  await expect(
    page.getByRole("heading", { name: "Finalizá tu pedido" }),
  ).toBeVisible();
  await expect(page.locator('input[name="customerName"]')).toHaveValue(
    fixture.buyer.displayName,
  );
  await expect(page.locator('input[name="customerPhone"]')).toHaveValue(
    fixture.buyer.phone,
  );

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

  const reviewButton = page.getByRole("button", { name: "Revisar pedido" });
  await expect(reviewButton).toBeEnabled();
  await reviewButton.click();
  await expect(
    page.getByText("Pedido revisado", { exact: true }),
  ).toBeVisible();
}

function confirmButton(page: Page) {
  return page
    .locator(".checkout-review-panel")
    .getByRole("button", { name: "Confirmar pedido" });
}

function unknownOutcomeAlert(page: Page) {
  return page
    .locator('p.checkout-alert[role="alert"]')
    .filter({ hasText: UNKNOWN_OUTCOME_MESSAGE });
}

async function ordersForBuyer(fixture: DevBuyerFixture) {
  return fixture.sql<{ id: string; status: string }[]>`
    select id, status
    from orders
    where customer_user_id = ${fixture.buyer.userId}
      and merchant_id = ${fixture.merchant.id}
      and created_at >= ${fixture.startedAt}
    order by created_at
  `;
}

test.describe("WRITE_DEV buyer idempotent retry", () => {
  test("lost confirmation response retries the same order without double stock decrement", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    expect(process.env.E2E_MODE).toBe(E2E_WRITE_DEV_MODE);

    const fixture = await createDevBuyerFixture({
      productLabel: "Idempotent retry product",
      stock: 5,
    });

    let swallowedPlaceResponse = false;
    const lostResponseHandler = async (route: Route): Promise<void> => {
      if (route.request().method() !== "POST" || swallowedPlaceResponse) {
        await route.continue();
        return;
      }

      const upstream = await route.fetch();
      expect(
        upstream.ok(),
        "the swallowed place-order request must reach the app",
      ).toBe(true);
      swallowedPlaceResponse = true;
      await route.abort("failed");
    };

    try {
      await loginAndReviewPickupOrder(page, fixture);

      await page.route("**/checkout", lostResponseHandler);

      const confirm = confirmButton(page);
      await expect(confirm).toBeEnabled();
      await confirm.click();

      await expect(unknownOutcomeAlert(page)).toHaveText(
        UNKNOWN_OUTCOME_MESSAGE,
        { timeout: 15_000 },
      );
      const retry = page.getByRole("button", {
        name: "Reintentar confirmación",
      });
      await expect(retry).toBeEnabled();
      expect(swallowedPlaceResponse).toBe(true);

      await expect
        .poll(async () => (await ordersForBuyer(fixture)).length)
        .toBe(1);
      const [firstOrder] = await ordersForBuyer(fixture);
      expect(firstOrder?.status).toBe("PENDING");
      fixture.registerOrder(firstOrder!.id);

      const [stockAfterLostResponse] = await fixture.sql<
        { stock_quantity: number | null }[]
      >`
        select stock_quantity
        from products
        where id = ${fixture.product.id}
      `;
      expect(stockAfterLostResponse?.stock_quantity).toBe(4);

      await page.unroute("**/checkout", lostResponseHandler);
      await retry.click();

      await expect(
        page.getByRole("heading", { name: "Pedido recibido" }),
      ).toBeVisible({ timeout: 15_000 });
      const trackingLink = page.getByRole("link", { name: "Seguir mi pedido" });
      const href = await trackingLink.getAttribute("href");
      const match = href?.match(/^\/cuenta\/pedidos\/([0-9a-f-]{36})$/i);
      expect(
        match,
        "retry success screen must expose the persisted order id",
      ).toBeTruthy();
      expect(match![1]).toBe(firstOrder!.id);

      const ordersAfterRetry = await ordersForBuyer(fixture);
      expect(ordersAfterRetry).toHaveLength(1);
      expect(ordersAfterRetry[0]?.id).toBe(firstOrder!.id);

      const [stockAfterRetry] = await fixture.sql<
        { stock_quantity: number | null }[]
      >`
        select stock_quantity
        from products
        where id = ${fixture.product.id}
      `;
      expect(stockAfterRetry?.stock_quantity).toBe(4);

      const events = await fixture.sql<{ id: string }[]>`
        select id
        from order_events
        where order_id = ${firstOrder!.id}
      `;
      expect(events).toHaveLength(1);
    } finally {
      await page
        .unroute("**/checkout", lostResponseHandler)
        .catch(() => undefined);
      await fixture.cleanup();
    }
  });
});
