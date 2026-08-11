import "server-only";

import { redirect } from "next/navigation";
import { isAuthzError } from "@/server/auth/errors";
import { requirePlatformAdmin } from "@/server/auth/authorization";
import type { AuthorizedContext } from "@/server/auth/authorization";

export async function loadAdminContext(
  nextPath: string = "/admin",
): Promise<AuthorizedContext> {
  try {
    return await requirePlatformAdmin();
  } catch (error) {
    if (isAuthzError(error)) {
      if (error.code === "UNAUTHENTICATED" || error.code === "CONFIG_MISSING") {
        redirect(`/login?next=${encodeURIComponent(nextPath)}`);
      }
      redirect(`/login?next=${encodeURIComponent(nextPath)}&error=forbidden`);
    }
    throw error;
  }
}
