import type { MerchantUserRole } from "@/domain/merchant/enums";
import { AuthzError } from "./errors";
import type { AuthUser, MerchantMembership, UserProfileRecord } from "./types";

/**
 * Pure authorization decisions given already-verified identity + DB rows.
 * Session verification happens outside (Supabase getUser).
 */

export function assertAuthenticated(user: AuthUser | null): AuthUser {
  if (!user) {
    throw new AuthzError("UNAUTHENTICATED", "Authentication required");
  }
  return user;
}

export function assertActiveProfile(
  profile: UserProfileRecord | null,
): UserProfileRecord {
  if (!profile) {
    throw new AuthzError("PROFILE_MISSING", "User profile not found");
  }
  if (profile.status === "SUSPENDED") {
    throw new AuthzError("USER_SUSPENDED", "User account is suspended");
  }
  if (profile.status !== "ACTIVE") {
    throw new AuthzError("USER_SUSPENDED", "User account is not active");
  }
  return profile;
}

export function assertPlatformAdmin(profile: UserProfileRecord): void {
  if (profile.platformRole !== "ADMIN") {
    throw new AuthzError(
      "NOT_PLATFORM_ADMIN",
      "Platform administrator access required",
    );
  }
}

export function assertMerchantMembership(
  memberships: readonly MerchantMembership[],
  merchantId: string,
): MerchantMembership {
  const membership = memberships.find(
    (row) => row.merchantId === merchantId && row.active,
  );
  if (!membership) {
    throw new AuthzError("NOT_MERCHANT_MEMBER", "Merchant membership required");
  }
  return membership;
}

export function assertMerchantRole(
  membership: MerchantMembership,
  allowedRoles: readonly MerchantUserRole[],
): void {
  if (!allowedRoles.includes(membership.role)) {
    throw new AuthzError(
      "MERCHANT_ROLE_FORBIDDEN",
      "Merchant role is not permitted for this action",
    );
  }
}
