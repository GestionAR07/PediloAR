import { redirect } from "next/navigation";
import { resolveOAuthDestination } from "@/application/customer/oauth-continuation";
import { hasCompleteCustomerContact } from "@/application/customer/profile";
import { customerProfileHref } from "@/application/customer/profile";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { listActiveMerchantMemberships } from "@/server/auth/authorization";
import { isAuthzError } from "@/server/auth/errors";

export const dynamic = "force-dynamic";

export default async function OAuthContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  try {
    const context = await listActiveMerchantMemberships();
    const destination = resolveOAuthDestination({
      requestedNext: params.next,
      platformRole: context.profile.platformRole,
      memberships: context.memberships,
    });

    if (!hasCompleteCustomerContact(context.profile)) {
      redirect(customerProfileHref(destination, true));
    }
    redirect(destination);
  } catch (error) {
    if (isAuthzError(error)) {
      if (error.code === "USER_SUSPENDED") {
        const supabase = await createSupabaseServerClient();
        await supabase.auth.signOut();
        redirect("/login?error=forbidden");
      }
      redirect("/login?error=oauth_session");
    }
    throw error;
  }
}
