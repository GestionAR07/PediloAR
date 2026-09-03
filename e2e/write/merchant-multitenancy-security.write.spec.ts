import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import {
  createDevIsolatedBuyerMerchantFixture,
  type DevIsolatedBuyerMerchantFixture,
} from "../lib/dev-isolated-buyer-merchant-fixture";
import {
  createDevMerchantOperatorFixture,
  type DevMerchantOperatorFixture,
} from "../lib/dev-merchant-operator-fixture";
import { E2E_WRITE_DEV_MODE } from "../lib/dev-write-guard";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Merchant multitenancy E2E: missing ${name} after WRITE_DEV preflight.`,
    );
  }
  return value;
}

function createAuthenticatedPublicClient(): SupabaseClient {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

async function loginMerchant(
  page: Page,
  merchantId: string,
  operator: DevMerchantOperatorFixture,
): Promise<void> {
  const nextHref = `/merchant/${merchantId}`;
  await page.goto(`/login?next=${encodeURIComponent(nextHref)}`);
  await page.getByLabel("Email").fill(operator.email);
  await page.getByLabel("Contraseña").fill(operator.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(
    new RegExp(`${nextHref.replaceAll("/", "\\/")}(?:\\?.*)?$`),
  );
}

async function expectOwnWorkspaceAccessible(
  page: Page,
  fixture: DevIsolatedBuyerMerchantFixture,
): Promise<void> {
  const merchantId = fixture.merchant.id;

  await page.goto(`/merchant/${merchantId}/catalog`);
  await expect(page.getByRole("heading", { name: "Catálogo" })).toBeVisible();
  await expect(page.getByText(fixture.product.name, { exact: true })).toBeVisible();

  await page.goto(`/merchant/${merchantId}/delivery`);
  await expect(page.getByRole("heading", { name: "Envíos" })).toBeVisible();

  await page.goto(`/merchant/${merchantId}/payment-methods`);
  await expect(
    page.getByRole("heading", { name: "Medios de pago" }),
  ).toBeVisible();

  await page.goto(`/merchant/${merchantId}/profile`);
  await expect(page.getByRole("heading", { name: "Tienda" })).toBeVisible();

  await page.goto(
    `/merchant/${merchantId}/catalog/products/${fixture.product.id}`,
  );
  await expect(
    page.getByRole("heading", { name: "Editar producto" }),
  ).toBeVisible();
}

async function expectForeignWorkspaceForbidden(
  page: Page,
  target: DevIsolatedBuyerMerchantFixture,
): Promise<void> {
  const merchantId = target.merchant.id;
  const foreignPaths = [
    `/merchant/${merchantId}`,
    `/merchant/${merchantId}/catalog`,
    `/merchant/${merchantId}/delivery`,
    `/merchant/${merchantId}/payment-methods`,
    `/merchant/${merchantId}/profile`,
    `/merchant/${merchantId}/catalog/products/${target.product.id}`,
  ];

  for (const path of foreignPaths) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?next=\/merchant&error=forbidden$/);
    await expect(page.getByText(target.product.name, { exact: true })).toHaveCount(
      0,
    );
  }
}

async function cleanupFixtures(input: {
  operator: DevMerchantOperatorFixture | null;
  own: DevIsolatedBuyerMerchantFixture | null;
  target: DevIsolatedBuyerMerchantFixture | null;
}): Promise<void> {
  const failures: unknown[] = [];
  if (input.operator) {
    try {
      await input.operator.cleanup();
    } catch (error) {
      failures.push(error);
    }
  }
  if (input.own) {
    try {
      await input.own.cleanup();
    } catch (error) {
      failures.push(error);
    }
  }
  if (input.target) {
    try {
      await input.target.cleanup();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      "Merchant multitenancy E2E: fixture cleanup failed.",
    );
  }
}

test.describe("WRITE_DEV merchant multitenancy security", () => {
  test("STAFF can use its own workspace but cannot read another merchant workspace", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    expect(process.env.E2E_MODE).toBe(E2E_WRITE_DEV_MODE);

    let own: DevIsolatedBuyerMerchantFixture | null = null;
    let target: DevIsolatedBuyerMerchantFixture | null = null;
    let operator: DevMerchantOperatorFixture | null = null;

    try {
      own = await createDevIsolatedBuyerMerchantFixture({
        productLabel: "Staff own merchant product",
      });
      target = await createDevIsolatedBuyerMerchantFixture({
        productLabel: "Foreign target merchant product",
      });
      operator = await createDevMerchantOperatorFixture({
        sql: own.sql,
        merchantId: own.merchant.id,
        role: "STAFF",
      });

      await loginMerchant(page, own.merchant.id, operator);
      await expectOwnWorkspaceAccessible(page, own);

      const crossMembership = await own.sql<{ count: string }[]>`
        select count(*)::text as count
        from merchant_users
        where merchant_id = ${target.merchant.id}
          and user_id = ${operator.userId}
          and active = true
      `;
      expect(crossMembership[0]?.count).toBe("0");

      await expectForeignWorkspaceForbidden(page, target);

      await expectOwnWorkspaceAccessible(page, own);
    } finally {
      await cleanupFixtures({ operator, own, target });
    }
  });

  test("RLS exposes only member merchants and denies direct authenticated merchant writes", async () => {
    test.setTimeout(120_000);
    expect(process.env.E2E_MODE).toBe(E2E_WRITE_DEV_MODE);

    let own: DevIsolatedBuyerMerchantFixture | null = null;
    let target: DevIsolatedBuyerMerchantFixture | null = null;
    let operator: DevMerchantOperatorFixture | null = null;
    const supabase = createAuthenticatedPublicClient();

    try {
      own = await createDevIsolatedBuyerMerchantFixture({
        productLabel: "RLS own merchant product",
      });
      target = await createDevIsolatedBuyerMerchantFixture({
        productLabel: "RLS foreign merchant product",
      });
      operator = await createDevMerchantOperatorFixture({
        sql: own.sql,
        merchantId: own.merchant.id,
        role: "STAFF",
      });

      const signIn = await supabase.auth.signInWithPassword({
        email: operator.email,
        password: operator.password,
      });
      expect(signIn.error).toBeNull();
      expect(signIn.data.user?.id).toBe(operator.userId);

      const ownRead = await supabase
        .from("merchants")
        .select("id,name")
        .eq("id", own.merchant.id);
      expect(ownRead.error).toBeNull();
      expect(ownRead.data).toEqual([
        { id: own.merchant.id, name: own.merchant.name },
      ]);

      const foreignRead = await supabase
        .from("merchants")
        .select("id,name")
        .eq("id", target.merchant.id);
      expect(foreignRead.error).toBeNull();
      expect(foreignRead.data).toEqual([]);

      const [before] = await own.sql<
        { accepting_orders: boolean; paused_until: Date | null }[]
      >`
        select accepting_orders, paused_until
        from merchants
        where id = ${own.merchant.id}
      `;
      expect(before).toBeTruthy();

      const directWrite = await supabase
        .from("merchants")
        .update({
          accepting_orders: !before!.accepting_orders,
          paused_until: new Date(Date.now() + 60_000).toISOString(),
        })
        .eq("id", own.merchant.id)
        .select("id");
      expect(directWrite.data ?? []).toHaveLength(0);

      const [after] = await own.sql<
        { accepting_orders: boolean; paused_until: Date | null }[]
      >`
        select accepting_orders, paused_until
        from merchants
        where id = ${own.merchant.id}
      `;
      expect(after?.accepting_orders).toBe(before!.accepting_orders);
      expect(after?.paused_until?.getTime() ?? null).toBe(
        before!.paused_until?.getTime() ?? null,
      );
    } finally {
      await supabase.auth.signOut();
      await cleanupFixtures({ operator, own, target });
    }
  });
});
