import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres, { type Sql } from "postgres";
import { E2eCreatedResourceRegistry } from "./e2e-run-scope";

export type DevOnboardingFixture = {
  sql: Sql;
  runId: string;
  marker: string;
  businessName: string;
  businessSlug: string;
  categoryName: string;
  productName: string;
  admin: {
    userId: string;
    email: string;
    password: string;
    displayName: string;
  };
  owner: {
    userId: string;
    email: string;
    password: string;
    displayName: string;
  };
  registerApplication(applicationId: string): void;
  registerMerchant(merchantId: string): void;
  registerProduct(productId: string): void;
  cleanup(): Promise<void>;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `E2E onboarding fixture: missing ${name} after WRITE_DEV preflight.`,
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
    "E2E onboarding fixture: user profile trigger did not materialize in time.",
  );
}

async function deleteAuthUser(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(
      `E2E onboarding fixture: auth cleanup failed (${error.message}).`,
    );
  }
}

async function createAuthUser(input: {
  admin: SupabaseClient;
  sql: Sql;
  email: string;
  password: string;
  displayName: string;
  platformRole: "ADMIN" | "USER";
}): Promise<string> {
  const { data, error } = await input.admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { display_name: input.displayName },
  });
  if (error || !data.user) {
    throw new Error(
      `E2E onboarding fixture: auth user creation failed (${error?.message ?? "no user"}).`,
    );
  }

  const userId = data.user.id;
  await waitForProfile(input.sql, userId);
  await input.sql`
    update user_profiles
    set display_name = ${input.displayName},
        status = 'ACTIVE',
        platform_role = ${input.platformRole},
        updated_at = now()
    where id = ${userId}
  `;
  return userId;
}

export async function createDevOnboardingFixture(): Promise<DevOnboardingFixture> {
  const databaseUrl = requiredEnv("DATABASE_URL");
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseSecretKey = requiredEnv("SUPABASE_SECRET_KEY");
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  const authAdmin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const registry = new E2eCreatedResourceRegistry();
  const compactRunId = registry.runId.slice(0, 20);
  const businessName = `${registry.marker} Onboarding comercio`;
  const businessSlug = `e2e-onboarding-${compactRunId}`;
  const categoryName = `${registry.marker} Categoría`;
  const productName = `${registry.marker} Producto listo`;
  const adminEmail = `e2e-onboarding-admin-${registry.runId}@example.invalid`;
  const ownerEmail = `e2e-onboarding-owner-${registry.runId}@example.invalid`;
  const adminPassword = `Pedilo-${randomUUID()}-Aa1!`;
  const ownerPassword = `Pedilo-${randomUUID()}-Aa1!`;
  const adminDisplayName = `${registry.marker} Platform admin`;
  const ownerDisplayName = `${registry.marker} Merchant owner`;

  let adminUserId: string | null = null;
  let ownerUserId: string | null = null;
  let applicationId: string | null = null;
  let merchantId: string | null = null;
  let productId: string | null = null;
  let closed = false;

  function registerApplication(id: string): void {
    applicationId = id;
    registry.register({ kind: "other", id });
  }

  function registerMerchant(id: string): void {
    merchantId = id;
    registry.register({ kind: "merchant", id });
  }

  function registerProduct(id: string): void {
    productId = id;
    registry.register({ kind: "product", id });
  }

  async function recoverCreatedIds(): Promise<void> {
    if (!applicationId) {
      const applications = await sql<{ id: string; merchant_id: string | null }[]>`
        select id, merchant_id
        from merchant_applications
        where business_name = ${businessName}
          and contact_email = ${ownerEmail}
      `;
      if (applications.length > 1) {
        throw new Error(
          "E2E onboarding fixture: application recovery was not unique.",
        );
      }
      if (applications[0]) {
        registerApplication(applications[0].id);
        if (applications[0].merchant_id && !merchantId) {
          registerMerchant(applications[0].merchant_id);
        }
      }
    } else if (!merchantId) {
      const applications = await sql<{ merchant_id: string | null }[]>`
        select merchant_id
        from merchant_applications
        where id = ${applicationId}
      `;
      if (applications[0]?.merchant_id) {
        registerMerchant(applications[0].merchant_id);
      }
    }

    if (merchantId && !productId) {
      const products = await sql<{ id: string }[]>`
        select id
        from products
        where merchant_id = ${merchantId}
          and name = ${productName}
      `;
      if (products.length > 1) {
        throw new Error("E2E onboarding fixture: product recovery was not unique.");
      }
      if (products[0]) registerProduct(products[0].id);
    }
  }

  async function cleanup(): Promise<void> {
    if (closed) return;
    const failures: unknown[] = [];

    try {
      await recoverCreatedIds();
    } catch (error) {
      failures.push(error);
    }

    if (productId) {
      try {
        await sql`delete from products where id = ${productId}`;
        const rows = await sql<{ id: string }[]>`
          select id from products where id = ${productId}
        `;
        if (rows.length !== 0) {
          throw new Error("E2E onboarding fixture: product cleanup failed.");
        }
        registry.clearRegistered({ kind: "product", id: productId });
      } catch (error) {
        failures.push(error);
      }
    }

    if (applicationId) {
      try {
        await sql`delete from merchant_applications where id = ${applicationId}`;
        const rows = await sql<{ id: string }[]>`
          select id from merchant_applications where id = ${applicationId}
        `;
        if (rows.length !== 0) {
          throw new Error("E2E onboarding fixture: application cleanup failed.");
        }
        registry.clearRegistered({ kind: "other", id: applicationId });
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
          throw new Error("E2E onboarding fixture: merchant cleanup failed.");
        }
        registry.clearRegistered({ kind: "merchant", id: merchantId });
      } catch (error) {
        failures.push(error);
      }
    }

    for (const userId of [ownerUserId, adminUserId]) {
      if (!userId) continue;
      try {
        await deleteAuthUser(authAdmin, userId);
        const rows = await sql<{ id: string }[]>`
          select id from user_profiles where id = ${userId}
        `;
        if (rows.length !== 0) {
          throw new Error("E2E onboarding fixture: profile cleanup failed.");
        }
        registry.clearRegistered({ kind: "auth_user", id: userId });
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
        "E2E onboarding fixture: cleanup failed.",
      );
    }
  }

  try {
    adminUserId = await createAuthUser({
      admin: authAdmin,
      sql,
      email: adminEmail,
      password: adminPassword,
      displayName: adminDisplayName,
      platformRole: "ADMIN",
    });
    registry.register({ kind: "auth_user", id: adminUserId });

    ownerUserId = await createAuthUser({
      admin: authAdmin,
      sql,
      email: ownerEmail,
      password: ownerPassword,
      displayName: ownerDisplayName,
      platformRole: "USER",
    });
    registry.register({ kind: "auth_user", id: ownerUserId });

    return {
      sql,
      runId: registry.runId,
      marker: registry.marker,
      businessName,
      businessSlug,
      categoryName,
      productName,
      admin: {
        userId: adminUserId,
        email: adminEmail,
        password: adminPassword,
        displayName: adminDisplayName,
      },
      owner: {
        userId: ownerUserId,
        email: ownerEmail,
        password: ownerPassword,
        displayName: ownerDisplayName,
      },
      registerApplication,
      registerMerchant,
      registerProduct,
      cleanup,
    };
  } catch (setupError) {
    try {
      await cleanup();
    } catch (cleanupError) {
      throw new AggregateError(
        [setupError, cleanupError],
        "E2E onboarding fixture: setup failed and cleanup also failed.",
      );
    }
    throw setupError;
  }
}
