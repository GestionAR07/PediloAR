import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { E2E_WRITE_DEV_MODE } from "../lib/dev-write-guard";
import {
  createDevBuyerFixture,
  type DevBuyerFixture,
} from "../lib/dev-buyer-fixture";

const INSUFFICIENT_STOCK_MESSAGE =
  "No hay stock suficiente. Volvé al carrito para corregir las cantidades.";
const REQUOTE_MESSAGE =
  "El pedido cambió desde la última revisión. Revisá los datos actualizados antes de confirmar.";

async function loginAndReviewPickupOrder(
  page: Page,
  fixture: DevBuyerFixture,
  quantity: number,
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
  for (let current = 1; current < quantity; current += 1) {
    await cartLine
      .getByRole("button", { name: `Aumentar ${fixture.product.name}` })
      .click();
  }
  await expect(cartLine.locator(".cart-qty-value")).toHaveText(
    String(quantity),
  );
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

async function ordersForBuyer(fixture: DevBuyerFixture) {
  return fixture.sql<{ id: string }[]>`
    select id
    from orders
    where customer_user_id = ${fixture.buyer.userId}
      and merchant_id = ${fixture.merchant.id}
      and created_at >= ${fixture.startedAt}
    order by created_at
  `;
}

test.describe("WRITE_DEV buyer adversarial checkout", () => {
  test("stock becoming insufficient after review blocks order and preserves cart", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    expect(process.env.E2E_MODE).toBe(E2E_WRITE_DEV_MODE);
    const fixture = await createDevBuyerFixture({
      productLabel: "Adversarial stock product",
      stock: 2,
    });

    try {
      await loginAndReviewPickupOrder(page, fixture, 2);

      await fixture.sql`
        update products
        set stock_quantity = 1,
            updated_at = now()
        where id = ${fixture.product.id}
      `;

      const confirm = confirmButton(page);
      await expect(confirm).toBeEnabled();
      await confirm.click();

      await expect(page.getByRole("alert")).toContainText(
        INSUFFICIENT_STOCK_MESSAGE,
      );
      await expect(confirmButton(page)).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "Volver al carrito" }),
      ).toBeVisible();
      await expect
        .poll(async () => (await ordersForBuyer(fixture)).length)
        .toBe(0);

      const [product] = await fixture.sql<{ stock_quantity: number | null }[]>`
        select stock_quantity
        from products
        where id = ${fixture.product.id}
      `;
      expect(product?.stock_quantity).toBe(1);

      await page.goto("/carrito");
      const cartLine = page
        .locator(".cart-line-card")
        .filter({ hasText: fixture.product.name });
      await expect(cartLine).toHaveCount(1);
      await expect(cartLine.locator(".cart-qty-value")).toHaveText("2");
    } finally {
      await fixture.cleanup();
    }
  });

  test("price change after review requires explicit requote confirmation", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    expect(process.env.E2E_MODE).toBe(E2E_WRITE_DEV_MODE);
    const revisedPriceCents = 15_000;
    const fixture = await createDevBuyerFixture({
      productLabel: "Adversarial requote product",
      priceCents: 12_345,
      stock: 5,
    });

    try {
      await loginAndReviewPickupOrder(page, fixture, 1);

      await fixture.sql`
        update products
        set price_cents = ${revisedPriceCents},
            updated_at = now()
        where id = ${fixture.product.id}
      `;

      const firstConfirm = confirmButton(page);
      await expect(firstConfirm).toBeEnabled();
      await firstConfirm.click();

      await expect(page.getByRole("alert")).toContainText(REQUOTE_MESSAGE);
      await expect
        .poll(async () => (await ordersForBuyer(fixture)).length)
        .toBe(0);

      const secondConfirm = confirmButton(page);
      await expect(secondConfirm).toBeEnabled();
      await secondConfirm.click();

      await expect(
        page.getByRole("heading", { name: "Pedido recibido" }),
      ).toBeVisible({ timeout: 15_000 });
      const trackingLink = page.getByRole("link", { name: "Seguir mi pedido" });
      const href = await trackingLink.getAttribute("href");
      const match = href?.match(/^\/cuenta\/pedidos\/([0-9a-f-]{36})$/i);
      expect(
        match,
        "success screen must expose the exact created order id",
      ).toBeTruthy();
      const orderId = match![1]!;
      fixture.registerOrder(orderId);

      const [order] = await fixture.sql<
        { id: string; total_cents: number; status: string }[]
      >`
        select id, total_cents, status
        from orders
        where id = ${orderId}
      `;
      expect(order?.status).toBe("PENDING");
      expect(Number(order?.total_cents)).toBe(revisedPriceCents);

      const [product] = await fixture.sql<{ stock_quantity: number | null }[]>`
        select stock_quantity
        from products
        where id = ${fixture.product.id}
      `;
      expect(product?.stock_quantity).toBe(4);
    } finally {
      await fixture.cleanup();
    }
  });
});
