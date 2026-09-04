import { shouldCollectCustomerContactBeforeDestination } from "@/application/customer/oauth-identity";
import {
  customerProfileHref,
  missingCustomerContactFields,
  type CustomerContactProfile,
} from "@/application/customer/profile";
import { isSafeInternalPath, sanitizeInternalPath } from "@/lib/safe-redirect";
import type { PlatformRole } from "@/server/auth/types";

export function resolveOAuthDestination(input: {
  requestedNext?: string | null;
  platformRole: PlatformRole;
  memberships: readonly { merchantId: string }[];
}): string {
  if (isSafeInternalPath(input.requestedNext)) {
    return sanitizeInternalPath(input.requestedNext);
  }
  if (input.platformRole === "ADMIN") {
    return "/admin";
  }
  const membership = input.memberships[0];
  if (membership) {
    return `/merchant/${membership.merchantId}`;
  }
  return "/cuenta";
}

/**
 * After Google login, send merchants/admins to their workspace even if the
 * customer phone is missing. Buyer destinations collect only the missing
 * contact fields — never a full "new account" onboarding.
 */
export function resolveOAuthContinueRedirect(input: {
  destination: string;
  profile: CustomerContactProfile;
}): string {
  if (!shouldCollectCustomerContactBeforeDestination(input.destination)) {
    return input.destination;
  }
  const missing = missingCustomerContactFields(input.profile);
  if (missing.length === 0) {
    return input.destination;
  }
  return customerProfileHref(input.destination, { required: true, missing });
}
