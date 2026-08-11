import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "../client";
import { merchantUsers, userProfiles } from "../schema";

export type MerchantUserRecord = {
  id: string;
  merchantId: string;
  userId: string;
  role: string;
  active: boolean;
};

export async function findMerchantUser(
  merchantId: string,
  userId: string,
): Promise<MerchantUserRecord | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: merchantUsers.id,
      merchantId: merchantUsers.merchantId,
      userId: merchantUsers.userId,
      role: merchantUsers.role,
      active: merchantUsers.active,
    })
    .from(merchantUsers)
    .where(
      and(
        eq(merchantUsers.merchantId, merchantId),
        eq(merchantUsers.userId, userId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function insertMerchantOwner(input: {
  merchantId: string;
  userId: string;
}): Promise<MerchantUserRecord> {
  const db = getDb();
  const rows = await db
    .insert(merchantUsers)
    .values({
      merchantId: input.merchantId,
      userId: input.userId,
      role: "OWNER",
      active: true,
    })
    .returning({
      id: merchantUsers.id,
      merchantId: merchantUsers.merchantId,
      userId: merchantUsers.userId,
      role: merchantUsers.role,
      active: merchantUsers.active,
    });
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to insert merchant membership");
  }
  return row;
}

export async function findUserProfileId(
  userId: string,
): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1);
  return rows[0]?.id ?? null;
}

/**
 * Ensures user_profiles row exists (Auth trigger may race).
 * Does not elevate platform_role. Never uses metadata for authorization.
 */
export async function ensureUserProfile(input: {
  userId: string;
  displayName?: string | null;
}): Promise<void> {
  const existing = await findUserProfileId(input.userId);
  if (existing) {
    return;
  }

  const db = getDb();
  await db
    .insert(userProfiles)
    .values({
      id: input.userId,
      displayName: input.displayName?.trim() || null,
      platformRole: "USER",
      status: "ACTIVE",
    })
    .onConflictDoNothing();

  // Trigger may have created concurrently; re-check.
  const after = await findUserProfileId(input.userId);
  if (!after) {
    // Brief race: wait and re-read once for trigger
    await new Promise((r) => setTimeout(r, 150));
    const retry = await findUserProfileId(input.userId);
    if (!retry) {
      throw new Error("User profile was not created after Auth invite");
    }
  }
}
