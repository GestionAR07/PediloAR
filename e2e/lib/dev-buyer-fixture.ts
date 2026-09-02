import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres, { type Sql } from "postgres";
import { E2eCreatedResourceRegistry } from "./e2e-run-scope";

const MERCHANT_NAME = "Comercio Prueba";
const DEFAULT_PRICE_CENTS = 12_345;
const DEFAULT_STOCK = 5;

type MerchantRow = {
  id: string;
  name: string;
  zone_id: string;
  timezone: string;
};

type CategoryRow = { id: string };
type PaymentRow = { code: string };
type CreatedId = { id: string };

export type DevBuyerFixture = {
  sql: Sql;
  merchant: {
    id: string;
    name: string;
    zoneId: string;
    timezone: string;
  };
  paymentMethodCode: string;
  product: {
    id: string;
    name: string;
    priceCents: number;
    initialStock: number;
  };
  buyer: {
    userId: string;
    email: string;
    password: string;
    displayName: string;
    phone: string;
  };
  startedAt: Date;
  registerOrder(orderId: string): void;
  cleanup(): Promise<void>;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `E2E buyer fixture: missing ${name} after WRITE_DEV preflight.`,
    );
  }
  return value;
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
    throw new Error(
      "E2E buyer fixture: could not resolve merchant-local weekday.",
    );
  }
  return value;
}

async function waitForProfile(sql: Sql, userId: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const rows = await sql<{ id: string }[]>`
      select id from user_profiles where id = ${userId}
    `;
    if (rows.length === 1) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    "E2E buyer fixture: user profile trigger did not materialize in time.",
  );
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
    throw new Error(
      `E2E buyer fixture: auth cleanup failed (${error.message}).`,
    );
  }
}

export async function createDevBuyerFixture(options?: {
  productLabel?: string;
  priceCents?: number;
  stock?: number;
}): Promise<DevBuyerFixture> {
  const databaseUrl = requiredEnv("DATABASE_URL");
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseSecretKey = requiredEnv("SUPABASE_SECRET_KEY");
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  const admin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const registry = new E2eCreatedResourceRegistry();
  const startedAt = new Date();
  const marker = registry.marker;
  const priceCents = options?.priceCents ?? DEFAULT_PRICE_CENTS;
  const initialStock = options?.stock ?? DEFAULT_STOCK;
  const email = `e2e-buyer-${registry.runId}@example.invalid`;
  const password = `Pedilo-${randomUUID()}-Aa1!`;
  const displayName = `${marker} Buyer`;
  const phone = "2804000000";
  const productName = `${marker} ${options?.productLabel ?? "Buyer product"}`;

  let merchantId: string | null = null;
  let productId: string | null = null;
  let openingIntervalId: string | null = null;
  let authUserId: string | null = null;

  async function cleanup(): Promise<void> {
    try {
      if (authUserId && merchantId) {
        const recoveredOrderIds = await recoverExactRunOrders(
          sql,
          authUserId,
          merchantId,
          startedAt,
        );
        for (const orderId of recoveredOrderIds) {
          registry.register({ kind: "order", id: orderId });
        }
      }

      for (const resource of registry
        .list()
        .filter((candidate) => candidate.kind === "order")) {
        await deleteOrderByExactId(sql, resource.id);
        registry.clearRegistered(resource);
      }

      if (productId) {
        await sql`delete from products where id = ${productId}`;
        const rows = await sql<{ id: string }[]>`
          select id from products where id = ${productId}
        `;
        if (rows.length !== 0) {
          throw new Error(
            "E2E buyer fixture: product cleanup verification failed.",
          );
        }
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
        if (profiles.length !== 0) {
          throw new Error(
            "E2E buyer fixture: profile cleanup verification failed.",
          );
        }
        registry.clearRegistered({ kind: "auth_user", id: authUserId });
      }

      registry.assertCleanupComplete();
    } finally {
      await sql.end({ timeout: 5 });
    }
  }

  try {
    const merchants = await sql<MerchantRow[]>`
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
    if (merchants.length !== 1) {
      throw new Error(
        `E2E buyer fixture: expected exactly one active, unpaused ${MERCHANT_NAME}.`,
      );
    }
    const merchant = merchants[0]!;
    merchantId = merchant.id;

    const categories = await sql<CategoryRow[]>`
      select id
      from merchant_categories
      where merchant_id = ${merchant.id}
        and active = true
      order by sort_order, id
      limit 1
    `;
    if (!categories[0]) {
      throw new Error(
        "E2E buyer fixture: active merchant category is required.",
      );
    }

    const payments = await sql<PaymentRow[]>`
      select code
      from merchant_payment_methods
      where merchant_id = ${merchant.id}
        and active = true
      order by sort_order, id
      limit 1
    `;
    if (!payments[0]) {
      throw new Error("E2E buyer fixture: active payment method is required.");
    }

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
        ${categories[0].id},
        ${productName},
        ${"Run-scoped Playwright buyer-flow product."},
        ${priceCents},
        true,
        true,
        'TRACKED',
        ${initialStock},
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
        `E2E buyer fixture: auth user creation failed (${createUserError?.message ?? "no user"}).`,
      );
    }
    authUserId = createdUser.user.id;
    registry.register({ kind: "auth_user", id: authUserId });

    await waitForProfile(sql, authUserId);
    await sql`
      update user_profiles
      set display_name = ${displayName},
          phone = ${phone},
          status = 'ACTIVE',
          platform_role = 'USER',
          updated_at = now()
      where id = ${authUserId}
    `;

    return {
      sql,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        zoneId: merchant.zone_id,
        timezone: merchant.timezone,
      },
      paymentMethodCode: payments[0].code,
      product: {
        id: productId,
        name: productName,
        priceCents,
        initialStock,
      },
      buyer: {
        userId: authUserId,
        email,
        password,
        displayName,
        phone,
      },
      startedAt,
      registerOrder(orderId: string): void {
        registry.register({ kind: "order", id: orderId });
      },
      cleanup,
    };
  } catch (setupError) {
    try {
      await cleanup();
    } catch (cleanupError) {
      throw new AggregateError(
        [setupError, cleanupError],
        "E2E buyer fixture: setup failed and cleanup also failed.",
      );
    }
    throw setupError;
  }
}
