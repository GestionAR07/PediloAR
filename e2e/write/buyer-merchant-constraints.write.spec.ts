import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import {
  createDevIsolatedBuyerMerchantFixture,
  type DevIsolatedBuyerMerchantFixture,
} from "../lib/dev-isolated-buyer-merchant-fixture";
import { E2E_WRITE_DEV_MODE } from "../lib/dev-write-guard";

const PUBLIC_ZONE_STORAGE_KEY = "mr.public.zoneId";

async function loginBuyerAndAddProduct(
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

  await addFixtureProduct(page, fixture);
}

async function addFixtureProduct(
  page: Page,
  fixture: DevIsolatedBuyerMerchantFixture,
): Promise<void> {
  const search = page.getByLabel("Buscar en este comercio");
  await search.fill(fixture.product.name);
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

async function chooseCash(page: Page): Promise<void> {
  const payment = page.locator(
    'input[name="paymentMethodCode"][value="CASH"]',
  );
  await expect(payment).toBeVisible();
  await payment.check();
}

async function configurePickupCheckout(page: Page): Promise<void> {
  const pickup = page.locator(
    'input[name="fulfillmentMethod"][value="PICKUP"]',
  );
  await expect(pickup).toBeVisible();
  await pickup.check();
  await chooseCash(page);
}

async function configureDeliveryCheckout(
  page: Page,
  fixture: DevIsolatedBuyerMerchantFixture,
): Promise<void> {
  const delivery = page.locator(
    'input[name="fulfillmentMethod"][value="MERCHANT_DELIVERY"]',
  );
  await expect(delivery).toBeVisible();
  await delivery.check();
  await page
    .locator('select[name="deliveryZoneId"]')
    .selectOption(fixture.delivery.zoneId);
  await page.getByLabel("Calle").fill("E2E Avenida de prueba");
  await page.getByLabel("Número").fill("123");
  await page.getByLabel("Referencia (opcional)").fill("Buyer constraints E2E");
  await chooseCash(page);
}

async function reviewCheckout(page: Page): Promise<void> {
  const review = page.getByRole("button", { name: "Revisar pedido" });
  await expect(review).toBeEnabled();
  await review.click();
  await expect(
    page.getByText("Pedido revisado", { exact: true }),
  ).toBeVisible();
}

async function confirmReviewedCheckout(page: Page): Promise<void> {
  const confirm = page
    .locator(".checkout-review-panel")
    .getByRole("button", { name: "Confirmar pedido" });
  await expect(confirm).toBeEnabled();
  await confirm.click();
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

function weekdayInTimezone(now: Date, timezone: string): number {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(now);
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const value = weekdays[label];
  if (value == null) {
    throw new Error("Buyer constraints E2E: could not resolve local weekday.");
  }
  return value;
}

test.describe("WRITE_DEV buyer merchant constraints", () => {
  test("delivery minimum blocks review, offers product exploration and recovers after cart grows", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    expect(process.env.E2E_MODE).toBe(E2E_WRITE_DEV_MODE);

    const fixture = await createDevIsolatedBuyerMerchantFixture({
      productLabel: "Delivery minimum product",
      priceCents: 1_000_000,
      stock: 5,
      deliveryMinimumCents: 1_500_000,
    });

    try {
      await loginBuyerAndAddProduct(page, fixture);
      await page.evaluate(
        ({ key, zoneId }) => window.localStorage.setItem(key, zoneId),
        { key: PUBLIC_ZONE_STORAGE_KEY, zoneId: fixture.delivery.zoneId },
      );
      await openCheckout(page);
      await configureDeliveryCheckout(page, fixture);

      const minimumHint = page.getByRole("status").filter({
        hasText: "Pedido mínimo de esta zona",
      });
      await expect(minimumHint).toContainText("Agregá");
      await expect(
        page.getByRole("button", { name: "Revisar pedido" }),
      ).toBeDisabled();

      await page.getByRole("link", { name: "Explorar productos" }).click();
      await expect(page).toHaveURL(
        new RegExp(`/comercios/${fixture.merchant.id}(?:\\?.*)?$`),
      );
      await addFixtureProduct(page, fixture);

      await page.goto("/carrito");
      const cartLine = page
        .locator(".cart-line-card")
        .filter({ hasText: fixture.product.name });
      await expect(cartLine.locator(".cart-qty-value")).toHaveText("2");
      await page.getByRole("link", { name: "Continuar" }).click();
      await configureDeliveryCheckout(page, fixture);

      await expect(
        page.getByRole("status").filter({ hasText: "Pedido mínimo de esta zona" }),
      ).toHaveCount(0);
      await reviewCheckout(page);
      await expectNoOrders(fixture);
      await expectInitialStock(fixture);
    } finally {
      await fixture.cleanup();
    }
  });

  test("merchant pause after review blocks confirmation without creating an order", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    expect(process.env.E2E_MODE).toBe(E2E_WRITE_DEV_MODE);

    const fixture = await createDevIsolatedBuyerMerchantFixture({
      productLabel: "Pause after review product",
      merchantDeliveryEnabled: false,
    });

    try {
      await loginBuyerAndAddProduct(page, fixture);
      await openCheckout(page);
      await configurePickupCheckout(page);
      await reviewCheckout(page);

      await fixture.sql`
        update merchants
        set paused_until = now() + interval '1 hour', updated_at = now()
        where id = ${fixture.merchant.id}
      `;

      await confirmReviewedCheckout(page);
      await expect(page.getByRole("alert")).toContainText(
        "Este comercio no está tomando pedidos en este momento.",
      );
      await expectNoOrders(fixture);
      await expectInitialStock(fixture);
    } finally {
      await fixture.cleanup();
    }
  });

  test("merchant closing after review blocks confirmation without creating an order", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    expect(process.env.E2E_MODE).toBe(E2E_WRITE_DEV_MODE);

    const fixture = await createDevIsolatedBuyerMerchantFixture({
      productLabel: "Closed after review product",
      merchantDeliveryEnabled: false,
    });

    try {
      await loginBuyerAndAddProduct(page, fixture);
      await openCheckout(page);
      await configurePickupCheckout(page);
      await reviewCheckout(page);

      const currentWeekday = weekdayInTimezone(
        new Date(),
        fixture.merchant.timezone,
      );
      const differentWeekday = (currentWeekday + 1) % 7;
      await fixture.sql`
        update merchant_opening_intervals
        set weekday = ${differentWeekday}, updated_at = now()
        where id = ${fixture.merchant.openingIntervalId}
      `;

      await confirmReviewedCheckout(page);
      await expect(page.getByRole("alert")).toContainText(
        "Este comercio está cerrado en este momento.",
      );
      await expectNoOrders(fixture);
      await expectInitialStock(fixture);
    } finally {
      await fixture.cleanup();
    }
  });
});
