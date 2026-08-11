import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import {
  cities,
  merchantUsers,
  merchants,
  userProfiles,
  zones,
} from "@/infrastructure/db/schema";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { hasSupabasePublicConfig } from "@/infrastructure/supabase/env";
import { AuthzError } from "./errors";
import {
  assertActiveProfile,
  assertAuthenticated,
  assertMerchantMembership,
  assertMerchantRole,
  assertPlatformAdmin,
} from "./policy";
import type {
  AuthUser,
  MerchantMembership,
  PlatformRole,
  UserProfileRecord,
  UserProfileStatus,
} from "./types";
import {
  isMerchantUserRole,
  isPlatformRole,
  isUserProfileStatus,
} from "./types";
import type { MerchantUserRole } from "@/domain/merchant/enums";

export type AuthorizedContext = {
  user: AuthUser;
  profile: UserProfileRecord;
};

export type MerchantAuthorizedContext = AuthorizedContext & {
  membership: MerchantMembership;
};

async function loadVerifiedAuthUser(): Promise<AuthUser | null> {
  if (!hasSupabasePublicConfig()) {
    throw new AuthzError(
      "CONFIG_MISSING",
      "Supabase public configuration is missing",
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
  };
}

async function loadProfile(userId: string): Promise<UserProfileRecord | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: userProfiles.id,
      platformRole: userProfiles.platformRole,
      status: userProfiles.status,
      displayName: userProfiles.displayName,
    })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  if (!isPlatformRole(row.platformRole) || !isUserProfileStatus(row.status)) {
    throw new AuthzError("PROFILE_MISSING", "User profile data is invalid");
  }

  return {
    id: row.id,
    platformRole: row.platformRole as PlatformRole,
    status: row.status as UserProfileStatus,
    displayName: row.displayName,
  };
}

async function loadMemberships(userId: string): Promise<MerchantMembership[]> {
  const db = getDb();
  const rows = await db
    .select({
      merchantId: merchantUsers.merchantId,
      merchantName: merchants.name,
      role: merchantUsers.role,
      active: merchantUsers.active,
      merchantStatus: merchants.status,
      cityName: cities.name,
      zoneName: zones.name,
    })
    .from(merchantUsers)
    .innerJoin(merchants, eq(merchants.id, merchantUsers.merchantId))
    .innerJoin(cities, eq(cities.id, merchants.cityId))
    .innerJoin(zones, eq(zones.id, merchants.zoneId))
    .where(
      and(eq(merchantUsers.userId, userId), eq(merchantUsers.active, true)),
    );

  return rows.map((row) => {
    if (!isMerchantUserRole(row.role)) {
      throw new AuthzError(
        "NOT_MERCHANT_MEMBER",
        "Merchant membership role is invalid",
      );
    }
    return {
      merchantId: row.merchantId,
      merchantName: row.merchantName,
      role: row.role,
      active: row.active,
      merchantStatus: row.merchantStatus,
      cityName: row.cityName,
      zoneName: row.zoneName,
    };
  });
}

/** Verified Supabase session user, or throws UNAUTHENTICATED. */
export async function requireAuthenticatedUser(): Promise<AuthUser> {
  const user = await loadVerifiedAuthUser();
  return assertAuthenticated(user);
}

/** Authenticated + profile ACTIVE. */
export async function requireActiveUser(): Promise<AuthorizedContext> {
  const user = await requireAuthenticatedUser();
  const profile = assertActiveProfile(await loadProfile(user.id));
  return { user, profile };
}

/** Active user with platform_role ADMIN. */
export async function requirePlatformAdmin(): Promise<AuthorizedContext> {
  const context = await requireActiveUser();
  assertPlatformAdmin(context.profile);
  return context;
}

/** Active user with membership in the given merchant. */
export async function requireMerchantMembership(
  merchantId: string,
): Promise<MerchantAuthorizedContext> {
  const context = await requireActiveUser();
  const memberships = await loadMemberships(context.user.id);
  const membership = assertMerchantMembership(memberships, merchantId);
  return { ...context, membership };
}

/** Active user with one of the allowed merchant roles for the merchant. */
export async function requireMerchantRole(
  merchantId: string,
  allowedRoles: readonly MerchantUserRole[],
): Promise<MerchantAuthorizedContext> {
  const context = await requireMerchantMembership(merchantId);
  assertMerchantRole(context.membership, allowedRoles);
  return context;
}

/** Active memberships for the signed-in user (for merchant home validation). */
export async function listActiveMerchantMemberships(): Promise<{
  user: AuthUser;
  profile: UserProfileRecord;
  memberships: MerchantMembership[];
}> {
  const context = await requireActiveUser();
  const memberships = await loadMemberships(context.user.id);
  return { ...context, memberships };
}
