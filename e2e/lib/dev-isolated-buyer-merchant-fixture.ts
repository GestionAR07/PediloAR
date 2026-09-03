import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres, { type Sql } from "postgres";
import { E2eCreatedResourceRegistry } from "./e2e-run-scope";

const SOURCE_MERCHANT_NAME = "Comercio Prueba";
const DEFAULT_PRICE_CENTS = 1_000_000;
const DEFAULT_STOCK = 5;
const DEFAULT_DELIVERY_FEE_CENTS = 150_000;
const DEFAULT_DELIVERY_MINIMUM_CENTS = 1_500_000;

type SourceMerchantRow = {
  city_id: string;
  zone_id: string;
  timezone: string;
};

type CreatedId = { id: string };

export type DevIsolatedBuyerMerchantFixture = {
  sql: Sql;
  runId: string;
  marker: string;
  merchant: {
    id: string;
    name: string;
    slug: string;
    zoneId: string;
    timezone: string;
    openingIntervalId: string;
  };
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
  paymentMethodCode: "CASH";
  delivery: {
    zoneId: string;
    feeCents: number;
    minimumOrderCents: number;
  };
  registerOrder(orderId: string): void;
  cleanup(): Promise<void>;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `E2E isolated buyer fixture: missing ${name} after WRITE_DEV preflight.`,
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
      "E2E isolated buyer fixture: could not resolve merchant-local weekday.",
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
    "E2E isolated buyer fixture: user profile trigger did not materialize in time.",
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
      `E2E isolated buyer fixture: auth cleanup failed (${error.message}).`,
    );
  }
}

export async function createDevIsolatedBuyerMerchantFixture(options?: {
  productLabel?: string;
  priceCents?: number;
  stock?: number;
  pickupEnabled?: boolean;
  merchantDeliveryEnabled?: boolean;
  deliveryFeeCents?: number;
  deliveryMinimumCents?: number;
}): Promise<DevIsolatedBuyerMerchantFixture> {
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
  const compactRunId = registry.runId.replaceAll("-", "").slice(0, 24);
  const merchantName = `${marker} Buyer constraints merchant`;
  const merchantSlug = `e2e-buyer-constraints-${compactRunId}`;
  const categoryName = `${marker} Buyer constraints category`;
  const productName = `${marker} ${options?.productLabel ?? "Buyer constraints product"}`;
  const priceCents = options?.priceCents ?? DEFAULT_PRICE_CENTS;
  const initialStock = options?.stock ?? DEFAULT_STOCK;
  const pickupEnabled = options?.pickupEnabled ?? true;
  const merchantDeliveryEnabled = options?.merchantDeliveryEnabled ?? true;
  const deliveryFeeCents =
    options?.deliveryFeeCents ?? DEFAULT_DELIVERY_FEE_CENTS;
  const deliveryMinimumCents =
    options?.deliveryMinimumCents ?? DEFAULT_DELIVERY_MINIMUM_CENTS;
  const email = `e2e-isolated-buyer-${registry.runId}@example.invalid`;
  const password = `Pedilo-${randomUUID()}-Aa1!`;
  const displayName = `${marker} Isolated buyer`;
  const phone = "2804000000";

  let merchantId: string | null = null;
  let productId: string | null = null;
  let authUserId: string | null = null;
  let openingIntervalId: string | null = null;
  let zoneId: string | null = null;
  let timezone: string | null = null;
  let closed = false;

  async function cleanup(): Promise<void> {
    if (closed) return;
    const failures: unknown[] = [];

    if (authUserId && merchantId) {
      try {
        const recoveredOrderIds = await recoverExactRunOrders(
          sql,
          authUserId,
          merchantId,
          startedAt,
        );
        for (const orderId of recoveredOrderIds) {
          registry.register({ kind: "order", id: orderId });
        }
      } catch (error) {
        failures.push(error);
      }
    }

    for (const resource of registry
      .list()
      .filter((candidate) => candidate.kind === "order")) {
      try {
        await deleteOrderByExactId(sql, resource.id);
        const rows = await sql<{ id: string }[]>`
          select id from orders where id = ${resource.id}
        `;
        if (rows.length !== 0) {
          throw new Error(
            "E2E isolated buyer fixture: order cleanup verification failed.",
          );
        }
        registry.clearRegistered(resource);
      } catch (error) {
        failures.push(error);
      }
    }

    if (productId) {
      try {
        await sql`delete from products where id = ${productId}`;
        const rows = await sql<{ id: string }[]>`
          select id from products where id = ${productId}
        `;
        if (rows.length !== 0) {
          throw new Error(
            "E2E isolated buyer fixture: product cleanup verification failed.",
          );
        }
        registry.clearRegistered({ kind: "product", id: productId });
      } catch (error) {
        failures.push(error);
      }
    }

    if (merchantId) {
      try {
        await sql`delete from merchants where id = ${merchantId}`;
        const rows = await sql<{ id: string }[]>`
          select id from merchants where id = ${merchantId}
        `;
        if (rows.length !== 0) {
          throw new Error(
            "E2E isolated buyer fixture: merchant cleanup verification failed.",
          );
        }
        registry.clearRegistered({ kind: "merchant", id: merchantId });
      } catch (error) {
        failures.push(error);
      }
    }

    if (authUserId) {
      try {
        await deleteAuthUser(admin, authUserId);
        const rows = await sql<{ id: string }[]>`
          select id from user_profiles where id = ${authUserId}
        `;
        if (rows.length !== 0) {
          throw new Error(
            "E2E isolated buyer fixture: profile cleanup verification failed.",
          );
        }
        registry.clearRegistered({ kind: "auth_user", id: authUserId });
      } catch (error) {
        failures.push(error);
      }
    }

    try {
      registry.assertCleanupComplete();
    } catch (error) {
      failures.push(error);
    }

    try {
      await sql.end({ timeout: 5 });
    } catch (error) {
      failures.push(error);
    }
    closed = true;

    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        "E2E isolated buyer fixture: cleanup failed.",
      );
    }
  }

  try {
    const sources = await sql<SourceMerchantRow[]>`
      select m.city_id, m.zone_id, c.timezone
      from merchants m
      join cities c on c.id = m.city_id
      where m.name = ${SOURCE_MERCHANT_NAME}
        and m.status = 'ACTIVE'
      order by m.id
    `;
    if (sources.length !== 1) {
      throw new Error(
        `E2E isolated buyer fixture: expected exactly one active ${SOURCE_MERCHANT_NAME}.`,
      );
    }
    const source = sources[0]!;
    zoneId = source.zone_id;
    timezone = source.timezone;

    const [merchant] = await sql<CreatedId[]>`
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
        preparation_minutes,
        accepting_orders
      ) values (
        ${source.city_id},
        ${source.zone_id},
        ${merchantName},
        ${merchantSlug},
        ${"Run-scoped isolated merchant for guarded buyer constraints E2E."},
        'ACTIVE',
        ${pickupEnabled},
        ${merchantDeliveryEnabled},
        false,
        20,
        true
      )
      returning id
    `;
    if (!merchant) {
      throw new Error("E2E isolated buyer fixture: merchant creation failed.");
    }
    merchantId = merchant.id;
    registry.register({ kind: "merchant", id: merchantId });

    const weekday = weekdayInTimezone(new Date(), source.timezone);
    const [openingInterval] = await sql<CreatedId[]>`
      insert into merchant_opening_intervals (
        merchant_id,
        weekday,
        open_minute,
        close_minute
      ) values (
        ${merchantId},
        ${weekday},
        0,
        1440
      )
      returning id
    `;
    openingIntervalId = openingInterval!.id;

    await sql`
      insert into merchant_payment_methods (
        merchant_id,
        code,
        label,
        instructions,
        active,
        sort_order
      ) values (
        ${merchantId},
        'CASH',
        'Efectivo',
        'Pagás al recibir o retirar el pedido.',
        true,
        0
      )
    `;

    if (merchantDeliveryEnabled) {
      await sql`
        insert into merchant_delivery_zones (
          merchant_id,
          zone_id,
          delivery_fee_cents,
          minimum_order_cents,
          estimated_minutes,
          active
        ) values (
          ${merchantId},
          ${source.zone_id},
          ${deliveryFeeCents},
          ${deliveryMinimumCents},
          30,
          true
        )
      `;
    }

    const [category] = await sql<CreatedId[]>`
      insert into merchant_categories (
        merchant_id,
        name,
        sort_order,
        active
      ) values (
        ${merchantId},
        ${categoryName},
        0,
        true
      )
      returning id
    `;

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
        ${merchantId},
        ${category!.id},
        ${productName},
        ${"Run-scoped product for guarded buyer constraints E2E."},
        ${priceCents},
        true,
        true,
        'TRACKED',
        ${initialStock},
        0
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
        `E2E isolated buyer fixture: auth user creation failed (${createUserError?.message ?? "no user"}).`,
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
      runId: registry.runId,
      marker,
      merchant: {
        id: merchantId,
        name: merchantName,
        slug: merchantSlug,
        zoneId,
        timezone,
        openingIntervalId,
      },
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
      paymentMethodCode: "CASH",
      delivery: {
        zoneId,
        feeCents: deliveryFeeCents,
        minimumOrderCents: deliveryMinimumCents,
      },
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
        "E2E isolated buyer fixture: setup failed and cleanup also failed.",
      );
    }
    throw setupError;
  }
}
