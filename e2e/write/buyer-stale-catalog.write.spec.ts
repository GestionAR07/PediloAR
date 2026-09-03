import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import {
  createDevIsolatedBuyerMerchantFixture,
  type DevIsolatedBuyerMerchantFixture,
} from "../lib/dev-isolated-buyer-merchant-fixture";
import { E2E_WRITE_DEV_MODE } from "../lib/dev-write-guard";

const PRODUCT_NOT_SELLABLE_MESSAGE =
  "Un producto ya no se puede pedir. Volvé al carrito para corregirlo.";
const INVALID_OPTIONS_MESSAGE =
  "La selección de opciones ya no es válida. Volvé al carrito para corregirla.";

async function loginAndReviewPickupOrder(
  page: Page,
  fixture: DevIsolatedBuyerMerchantFixture,
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
}

function confirmButton(page: Page) {
  return page
    .locator(".checkout-review-panel")
    .getByRole("button", { name: "Confirmar pedido" });
}

function checkoutErrorAlert(page: Page) {
  return page.locator('p.checkout-alert[role="alert"]');
}

async function expectNoOrders(
  fixture: DevIsolatedBuyerMerchantFixture,
): Promise<void> {
  const rows = await fixture.sql<{ id: string }[]>`
    select id
    from orders
    where customer_user_id = ${fixture.buyer.userId}
      and merchant_id = ${fixture.merchant.id}
      and created_at >= ${new Date(Date.now() - 15 * 60 * 1000)}
  `;
  expect(rows).toHaveLength(0);
}

async function expectInitialStock(
  fixture: DevIsolatedBuyerMerchantFixture,
): Promise<void> {
  const [row] = await fixture.sql<{ stock_quantity: number | null }[]>`
    select stock_quantity
    from products
    where id = ${fixture.product.id}
  `;
  expect(row?.stock_quantity).toBe(fixture.product.initialStock);
}

test.describe("WRITE_DEV buyer stale catalog guards", () => {
  test("product becoming unavailable after review blocks confirmation without creating an order", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    expect(process.env.E2E_MODE).toBe(E2E_WRITE_DEV_MODE);

    const fixture = await createDevIsolatedBuyerMerchantFixture({
      productLabel: "Unavailable after review product",
      merchantDeliveryEnabled: false,
    });

    try {
      await loginAndReviewPickupOrder(page, fixture);

      await fixture.sql`
        update products
        set available = false,
            updated_at = now()
        where id = ${fixture.product.id}
      `;

      const confirm = confirmButton(page);
      await expect(confirm).toBeEnabled();
      await confirm.click();

      await expect(checkoutErrorAlert(page)).toContainText(
        PRODUCT_NOT_SELLABLE_MESSAGE,
      );
      await expect(confirmButton(page)).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "Volver al carrito", exact: true }),
      ).toBeVisible();
      await expectNoOrders(fixture);
      await expectInitialStock(fixture);

      await page.getByRole("link", { name: "Volver al carrito", exact: true }).click();
      const cartLine = page
        .locator(".cart-line-card")
        .filter({ hasText: fixture.product.name });
      await expect(cartLine).toHaveCount(1);
      await expect(cartLine).toContainText("No disponible");
    } finally {
      await fixture.cleanup();
    }
  });

  test("new required option after review blocks stale configuration without creating an order", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    expect(process.env.E2E_MODE).toBe(E2E_WRITE_DEV_MODE);

    const fixture = await createDevIsolatedBuyerMerchantFixture({
      productLabel: "Required option after review product",
      merchantDeliveryEnabled: false,
    });

    try {
      await loginAndReviewPickupOrder(page, fixture);

      const [group] = await fixture.sql<{ id: string }[]>`
        insert into product_option_groups (
          product_id,
          name,
          selection_mode,
          min_selections,
          max_selections,
          sort_order,
          active
        ) values (
          ${fixture.product.id},
          ${`${fixture.marker} Required choice`},
          'SINGLE',
          1,
          1,
          0,
          true
        )
        returning id
      `;
      expect(group?.id).toBeTruthy();

      await fixture.sql`
        insert into product_option_choices (
          group_id,
          name,
          price_delta_cents,
          sort_order,
          active
        ) values (
          ${group!.id},
          ${`${fixture.marker} New required choice`},
          0,
          0,
          true
        )
      `;

      const confirm = confirmButton(page);
      await expect(confirm).toBeEnabled();
      await confirm.click();

      await expect(checkoutErrorAlert(page)).toContainText(
        INVALID_OPTIONS_MESSAGE,
      );
      await expect(confirmButton(page)).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "Volver al carrito", exact: true }),
      ).toBeVisible();
      await expectNoOrders(fixture);
      await expectInitialStock(fixture);
    } finally {
      await fixture.cleanup();
    }
  });
});
