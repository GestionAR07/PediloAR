import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres, { type Sql } from "postgres";
import { expect, test } from "../fixtures";
import { E2E_WRITE_DEV_MODE } from "../lib/dev-write-guard";
import { E2eCreatedResourceRegistry } from "../lib/e2e-run-scope";

type MerchantFixture = {
  id: string;
  name: string;
  zone_id: string;
  timezone: string;
};

type CategoryFixture = {
  id: string;
};

type PaymentFixture = {
  code: string;
};

type CreatedId = {
  id: string;
};

type OrderRow = {
  id: string;
  status: string;
  fulfillment_method: string;
  customer_user_id: string | null;
};

type OrderItemRow = {
  id: string;
  product_id: string | null;
  quantity: number;
};

const MERCHANT_NAME = "Comercio Prueba";
const INITIAL_STOCK = 5;
const ORDER_QUANTITY = 2;
const PRODUCT_PRICE_CENTS = 12_345;

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
    throw new Error(
      "E2E buyer flow: could not resolve merchant-local weekday.",
    );
  }
  return value;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `E2E buyer flow: missing ${name} after WRITE_DEV preflight.`,
    );
  }
  return value;
}

async function deleteOrderByExactId(sql: Sql, orderId: string): Promise<void> {
  const items = await sql<{ id: string }[]>`
    select id
    from order_items
    where order_id = ${orderId}
  `;
  const itemIds = items.map((item) => item.id);

  await sql`delete from deliveries where order_id = ${orderId}`;
  if (itemIds.length > 0) {
    await sql`
      delete from order_item_options
      where order_item_id = any(${itemIds}::uuid[])
    `;
  }
  await sql`delete from order_items where order_id = ${orderId}`;
  await sql`delete from order_events where order_id = ${orderId}`;
  await sql`delete from orders where id = ${orderId}`;
}

async function recoverExactRunOrders(
  sql: Sql,
  customerUserId: string,
  merchantId: string,
  startedAt: Date,
): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`
    select id
    from orders
    where customer_user_id = ${customerUserId}
      and merchant_id = ${merchantId}
      and created_at >= ${startedAt}
  `;
  return rows.map((row) => row.id);
}

async function deleteAuthUser(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(`E2E buyer flow: auth cleanup failed (${error.message}).`);
  }
}

test.describe("WRITE_DEV authenticated buyer order flow", () => {
  test("buyer logs in, adds a product, reviews and places a pickup order", async ({
    page,
  }) => {
    expect(process.env.E2E_MODE).toBe(E2E_WRITE_DEV_MODE);

    const databaseUrl = requiredEnv("DATABASE_URL");
    const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseSecretKey = requiredEnv("SUPABASE_SECRET_KEY");
    const registry = new E2eCreatedResourceRegistry();
    const startedAt = new Date();
    const marker = registry.marker;
    const sql = postgres(databaseUrl, { max: 1, prepare: false });
    const admin = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    let merchantId: string | null = null;
    let productId: string | null = null;
    let openingIntervalId: string | null = null;
    let authUserId: string | null = null;
    let orderId: string | null = null;

    const email = `e2e-buyer-${registry.runId}@example.invalid`;
    const password = `Pedilo-${randomUUID()}-Aa1!`;
    const displayName = `${marker} Buyer`;
    const phone = "2804000000";
    const productName = `${marker} Buyer pickup product`;

    try {
      const merchants = await sql<MerchantFixture[]>`
        select m.id, m.name, m.zone_id, c.timezone
        from merchants m
        join cities c on c.id = m.city_id
        where m.name = ${MERCHANT_NAME}
          and m.status = 'ACTIVE'
          and m.accepting_orders = true
          and m.pickup_enabled = true
          and (m.paused_until is null or m.paused_until <= now())
        order by m.id
      `;
      expect(
        merchants,
        `DEV fixture requires exactly one active, unpaused ${MERCHANT_NAME}`,
      ).toHaveLength(1);
      const merchant = merchants[0]!;
      merchantId = merchant.id;

      const categories = await sql<CategoryFixture[]>`
        select id
        from merchant_categories
        where merchant_id = ${merchant.id}
          and active = true
        order by sort_order, id
        limit 1
      `;
      expect(
        categories[0],
        "DEV fixture requires one active merchant category",
      ).toBeTruthy();

      const payments = await sql<PaymentFixture[]>`
        select code
        from merchant_payment_methods
        where merchant_id = ${merchant.id}
          and active = true
        order by sort_order, id
        limit 1
      `;
      expect(
        payments[0],
        "DEV fixture requires one active payment method",
      ).toBeTruthy();

      const weekday = weekdayInTimezone(new Date(), merchant.timezone);
      const [openingInterval] = await sql<CreatedId[]>`
        insert into merchant_opening_intervals (
          merchant_id,
          weekday,
          open_minute,
          close_minute
        ) values (
          ${merchant.id},
          ${weekday},
          0,
          1440
        )
        returning id
      `;
      openingIntervalId = openingInterval!.id;
      registry.register({ kind: "other", id: openingIntervalId });

      const [product] = await sql<CreatedId[]>`
        insert into products (
          merchant_id,
          merchant_category_id,
          name,
          description,
          price_cents,
          active,
          available,
          stock_mode,
          stock_quantity,
          sort_order
        ) values (
          ${merchant.id},
          ${categories[0]!.id},
          ${productName},
          ${"Run-scoped Playwright buyer-flow product."},
          ${PRODUCT_PRICE_CENTS},
          true,
          true,
          'TRACKED',
          ${INITIAL_STOCK},
          999999
        )
        returning id
      `;
      productId = product!.id;
      registry.register({ kind: "product", id: productId });

      const { data: createdUser, error: createUserError } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { display_name: displayName },
        });
      if (createUserError || !createdUser.user) {
        throw new Error(
          `E2E buyer flow: auth user creation failed (${createUserError?.message ?? "no user"}).`,
        );
      }
      authUserId = createdUser.user.id;
      registry.register({ kind: "auth_user", id: authUserId });

      await expect
        .poll(async () => {
          const profiles = await sql<{ id: string }[]>`
            select id from user_profiles where id = ${authUserId}
          `;
          return profiles.length;
        })
        .toBe(1);

      await sql`
        update user_profiles
        set display_name = ${displayName},
            phone = ${phone},
            status = 'ACTIVE',
            platform_role = 'USER',
            updated_at = now()
        where id = ${authUserId}
      `;

      const storefrontHref = `/comercios/${merchant.id}`;
      await page.goto(`/login?next=${encodeURIComponent(storefrontHref)}`);
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Contraseña").fill(password);
      await page.getByRole("button", { name: "Ingresar" }).click();
      await expect(page).toHaveURL(
        new RegExp(`/comercios/${merchant.id}(?:\\?.*)?$`),
      );

      await page.getByLabel("Buscar en este comercio").fill(productName);
      const productCard = page
        .locator("article")
        .filter({ hasText: productName });
      await expect(productCard).toHaveCount(1);
      await productCard.getByRole("button", { name: "Agregar" }).click();
      await expect(page.getByRole("status")).toContainText(
        "Agregado al carrito",
      );

      await page.goto("/carrito");
      const cartLine = page
        .locator(".cart-line-card")
        .filter({ hasText: productName });
      await expect(cartLine).toHaveCount(1);
      await cartLine
        .getByRole("button", { name: `Aumentar ${productName}` })
        .click();
      await expect(cartLine.locator(".cart-qty-value")).toHaveText(
        String(ORDER_QUANTITY),
      );
      await page.getByRole("link", { name: "Continuar" }).click();

      await expect(
        page.getByRole("heading", { name: "Finalizá tu pedido" }),
      ).toBeVisible();
      await expect(page.locator('input[name="customerName"]')).toHaveValue(
        displayName,
      );
      await expect(page.locator('input[name="customerPhone"]')).toHaveValue(
        phone,
      );

      const pickup = page.locator(
        'input[name="fulfillmentMethod"][value="PICKUP"]',
      );
      await expect(pickup).toBeVisible();
      await pickup.check();

      const payment = page.locator('input[name="paymentMethodCode"]').first();
      await expect(payment).toBeVisible();
      await payment.check();

      const reviewButton = page.getByRole("button", {
        name: "Revisar pedido",
      });
      await expect(reviewButton).toBeEnabled();
      await reviewButton.click();
      await expect(
        page.getByText("Pedido revisado", { exact: true }),
      ).toBeVisible();

      const confirmButton = page
        .locator(".checkout-review-panel")
        .getByRole("button", { name: "Confirmar pedido" });
      await expect(confirmButton).toBeEnabled();
      await confirmButton.click();

      await expect(
        page.getByRole("heading", { name: "Pedido recibido" }),
      ).toBeVisible();
      const trackingLink = page.getByRole("link", { name: "Seguir mi pedido" });
      const href = await trackingLink.getAttribute("href");
      const match = href?.match(/^\/cuenta\/pedidos\/([0-9a-f-]{36})$/i);
      expect(
        match,
        "success screen must expose the exact created order id",
      ).toBeTruthy();
      orderId = match![1]!;
      registry.register({ kind: "order", id: orderId });

      const [order] = await sql<OrderRow[]>`
        select id, status, fulfillment_method, customer_user_id
        from orders
        where id = ${orderId}
      `;
      expect(order?.status).toBe("PENDING");
      expect(order?.fulfillment_method).toBe("PICKUP");
      expect(order?.customer_user_id).toBe(authUserId);

      const items = await sql<OrderItemRow[]>`
        select id, product_id, quantity
        from order_items
        where order_id = ${orderId}
      `;
      expect(items).toHaveLength(1);
      expect(items[0]?.product_id).toBe(productId);
      expect(items[0]?.quantity).toBe(ORDER_QUANTITY);

      const [stock] = await sql<{ stock_quantity: number | null }[]>`
        select stock_quantity
        from products
        where id = ${productId}
      `;
      expect(stock?.stock_quantity).toBe(INITIAL_STOCK - ORDER_QUANTITY);
    } finally {
      try {
        if (authUserId && merchantId) {
          const recoveredOrderIds = await recoverExactRunOrders(
            sql,
            authUserId,
            merchantId,
            startedAt,
          );
          for (const recoveredOrderId of recoveredOrderIds) {
            registry.register({ kind: "order", id: recoveredOrderId });
          }
        }

        const scopedOrders = registry
          .list()
          .filter((resource) => resource.kind === "order");
        for (const resource of scopedOrders) {
          await deleteOrderByExactId(sql, resource.id);
          registry.clearRegistered(resource);
        }

        if (productId) {
          await sql`delete from products where id = ${productId}`;
          const rows = await sql<{ id: string }[]>`
            select id from products where id = ${productId}
          `;
          expect(rows).toHaveLength(0);
          registry.clearRegistered({ kind: "product", id: productId });
        }

        if (openingIntervalId) {
          await sql`
            delete from merchant_opening_intervals
            where id = ${openingIntervalId}
          `;
          registry.clearRegistered({ kind: "other", id: openingIntervalId });
        }

        if (authUserId) {
          await deleteAuthUser(admin, authUserId);
          const profiles = await sql<{ id: string }[]>`
            select id from user_profiles where id = ${authUserId}
          `;
          expect(profiles).toHaveLength(0);
          registry.clearRegistered({ kind: "auth_user", id: authUserId });
        }

        registry.assertCleanupComplete();
      } finally {
        await sql.end({ timeout: 5 });
      }
    }
  });
});
