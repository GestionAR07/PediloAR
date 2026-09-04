import { redirect } from "next/navigation";
import {
  resolveOAuthContinueRedirect,
  resolveOAuthDestination,
} from "@/application/customer/oauth-continuation";
import {
  gateOAuthEmail,
  isConflictingAuthIdentity,
  isOAuthEmailVerified,
  oauthDisplayNameFromMetadata,
} from "@/application/customer/oauth-identity";
import { ensureUserProfile } from "@/infrastructure/db/repositories/merchant-user-repository";
import {
  canCreateSupabaseAdminClient,
  createSupabaseAdminClient,
} from "@/infrastructure/supabase/admin";
import { findConflictingAuthUserByEmail } from "@/infrastructure/supabase/auth-admin";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { normalizeEmail } from "@/lib/email";
import { listActiveMerchantMemberships } from "@/server/auth/authorization";
import { isAuthzError } from "@/server/auth/errors";

export const dynamic = "force-dynamic";

export default async function OAuthContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: session, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !session.user) {
    redirect("/login?error=oauth_session");
  }

  const emailGate = gateOAuthEmail({
    email: session.user.email ?? null,
    emailVerified: isOAuthEmailVerified(session.user),
  });
  if (!emailGate.ok) {
    await supabase.auth.signOut();
    redirect("/login?error=oauth_session");
  }

  if (canCreateSupabaseAdminClient()) {
    let otherUserId: string | null = null;
    try {
      const other = await findConflictingAuthUserByEmail(
        createSupabaseAdminClient(),
        normalizeEmail(emailGate.email),
        session.user.id,
      );
      otherUserId = other?.id ?? null;
    } catch {
      await supabase.auth.signOut();
      redirect("/login?error=oauth_session");
    }
    if (
      isConflictingAuthIdentity({
        sessionUserId: session.user.id,
        otherUserIdWithSameEmail: otherUserId,
      })
    ) {
      await supabase.auth.signOut();
      redirect("/login?error=account_exists");
    }
  }

  try {
    let context;
    try {
      context = await listActiveMerchantMemberships();
    } catch (error) {
      if (!isAuthzError(error) || error.code !== "PROFILE_MISSING") {
        throw error;
      }
      await ensureUserProfile({
        userId: session.user.id,
        displayName: oauthDisplayNameFromMetadata(session.user.user_metadata),
      });
      context = await listActiveMerchantMemberships();
    }

    const destination = resolveOAuthDestination({
      requestedNext: params.next,
      platformRole: context.profile.platformRole,
      memberships: context.memberships,
    });
    redirect(
      resolveOAuthContinueRedirect({
        destination,
        profile: context.profile,
      }),
    );
  } catch (error) {
    if (isAuthzError(error)) {
      if (error.code === "USER_SUSPENDED") {
        await supabase.auth.signOut();
        redirect("/login?error=forbidden");
      }
      redirect("/login?error=oauth_session");
    }
    throw error;
  }
}
