import type { MerchantUserRole } from "@/domain/merchant/enums";

export type PlatformRole = "USER" | "ADMIN";
export type UserProfileStatus = "ACTIVE" | "SUSPENDED";

export type AuthUser = {
  id: string;
  email: string | null;
};

export type UserProfileRecord = {
  id: string;
  platformRole: PlatformRole;
  status: UserProfileStatus;
  displayName: string | null;
};

export type MerchantMembership = {
  merchantId: string;
  merchantName: string;
  role: MerchantUserRole;
  active: boolean;
  merchantStatus: string;
  cityName: string;
  zoneName: string;
};

export function isPlatformRole(value: string): value is PlatformRole {
  return value === "USER" || value === "ADMIN";
}

export function isUserProfileStatus(value: string): value is UserProfileStatus {
  return value === "ACTIVE" || value === "SUSPENDED";
}

export function isMerchantUserRole(value: string): value is MerchantUserRole {
  return value === "OWNER" || value === "STAFF";
}
