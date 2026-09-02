import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Sql } from "postgres";
import { E2eCreatedResourceRegistry } from "./e2e-run-scope";

export type DevMerchantOperatorFixture = {
  userId: string;
  membershipId: string;
  email: string;
  password: string;
  displayName: string;
  cleanup(): Promise<void>;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `E2E merchant operator fixture: missing ${name} after WRITE_DEV preflight.`,
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
    "E2E merchant operator fixture: user profile trigger did not materialize in time.",
  );
}

async function deleteAuthUser(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(
      `E2E merchant operator fixture: auth cleanup failed (${error.message}).`,
    );
  }
}

export async function createDevMerchantOperatorFixture(input: {
  sql: Sql;
  merchantId: string;
}): Promise<DevMerchantOperatorFixture> {
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseSecretKey = requiredEnv("SUPABASE_SECRET_KEY");
  const admin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const registry = new E2eCreatedResourceRegistry();
  const email = `e2e-merchant-${registry.runId}@example.invalid`;
  const password = `Pedilo-${randomUUID()}-Aa1!`;
  const displayName = `${registry.marker} Merchant operator`;

  let userId: string | null = null;
  let membershipId: string | null = null;

  async function cleanup(): Promise<void> {
    const failures: unknown[] = [];

    if (membershipId) {
      try {
        await input.sql`
          delete from merchant_users
          where id = ${membershipId}
        `;
        const memberships = await input.sql<{ id: string }[]>`
          select id from merchant_users where id = ${membershipId}
        `;
        if (memberships.length !== 0) {
          throw new Error(
            "E2E merchant operator fixture: membership cleanup verification failed.",
          );
        }
        registry.clearRegistered({ kind: "other", id: membershipId });
      } catch (error) {
        failures.push(error);
      }
    }

    if (userId) {
      try {
        await deleteAuthUser(admin, userId);
        const profiles = await input.sql<{ id: string }[]>`
          select id from user_profiles where id = ${userId}
        `;
        if (profiles.length !== 0) {
          throw new Error(
            "E2E merchant operator fixture: profile cleanup verification failed.",
          );
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

    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        "E2E merchant operator fixture: cleanup failed.",
      );
    }
  }

  try {
    const { data: createdUser, error: createUserError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });
    if (createUserError || !createdUser.user) {
      throw new Error(
        `E2E merchant operator fixture: auth user creation failed (${createUserError?.message ?? "no user"}).`,
      );
    }
    userId = createdUser.user.id;
    registry.register({ kind: "auth_user", id: userId });

    await waitForProfile(input.sql, userId);
    await input.sql`
      update user_profiles
      set display_name = ${displayName},
          status = 'ACTIVE',
          platform_role = 'USER',
          updated_at = now()
      where id = ${userId}
    `;

    const [membership] = await input.sql<{ id: string }[]>`
      insert into merchant_users (
        merchant_id,
        user_id,
        role,
        active
      ) values (
        ${input.merchantId},
        ${userId},
        'OWNER',
        true
      )
      returning id
    `;
    if (!membership) {
      throw new Error(
        "E2E merchant operator fixture: membership creation failed.",
      );
    }
    membershipId = membership.id;
    registry.register({ kind: "other", id: membershipId });

    return {
      userId,
      membershipId,
      email,
      password,
      displayName,
      cleanup,
    };
  } catch (setupError) {
    try {
      await cleanup();
    } catch (cleanupError) {
      throw new AggregateError(
        [setupError, cleanupError],
        "E2E merchant operator fixture: setup failed and cleanup also failed.",
      );
    }
    throw setupError;
  }
}
