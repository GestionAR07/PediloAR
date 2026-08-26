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
