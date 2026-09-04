/**
 * Google OAuth identity gates used after PKCE callback.
 *
 * Safe reuse: the session UUID already is the existing account (Supabase
 * automatic linking or the same auth.users row). Roles/memberships follow
 * that UUID — this module never copies merchant_users between users.
 *
 * Unsafe split: two auth.users share a verified email. We fail closed and
 * never rewrite memberships. See docs/GOOGLE_OAUTH.md.
 */

export type OAuthEmailGate =
  | { ok: true; email: string }
  | { ok: false; reason: "missing_email" | "unverified_email" };

export type OAuthEmailClaims = {
  email?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
  identities?: ReadonlyArray<{
    provider?: string;
    identity_data?: Record<string, unknown> | null;
  }> | null;
};

function metadataFlagTrue(value: unknown): boolean {
  return value === true || value === "true";
}

export function isOAuthEmailVerified(user: OAuthEmailClaims): boolean {
  if (!user.email?.trim()) {
    return false;
  }
  if (user.email_confirmed_at || user.confirmed_at) {
    return true;
  }
  if (metadataFlagTrue(user.user_metadata?.email_verified)) {
    return true;
  }
  const google = user.identities?.find(
    (identity) => identity.provider === "google",
  );
  return metadataFlagTrue(google?.identity_data?.email_verified);
}

export function gateOAuthEmail(input: {
  email: string | null | undefined;
  emailVerified: boolean;
}): OAuthEmailGate {
  const email = input.email?.trim() ?? "";
  if (!email) {
    return { ok: false, reason: "missing_email" };
  }
  if (!input.emailVerified) {
    return { ok: false, reason: "unverified_email" };
  }
  return { ok: true, email };
}

/**
 * True when Admin Auth lists another user with the same verified email.
 * Callers must sign out and show a controlled-linking message — never merge.
 */
export function isConflictingAuthIdentity(input: {
  sessionUserId: string;
  otherUserIdWithSameEmail: string | null;
}): boolean {
  return Boolean(
    input.otherUserIdWithSameEmail &&
    input.otherUserIdWithSameEmail !== input.sessionUserId,
  );
}

export function oauthDisplayNameFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata) {
    return null;
  }
  for (const key of ["display_name", "full_name", "name"] as const) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, 80);
    }
  }
  return null;
}

/**
 * Customer contact is only required on buyer destinations.
 * Merchant/admin home must not start a "new customer" onboarding.
 */
export function shouldCollectCustomerContactBeforeDestination(
  destination: string,
): boolean {
  if (destination === "/checkout" || destination.startsWith("/checkout?")) {
    return true;
  }
  if (destination === "/carrito" || destination.startsWith("/carrito?")) {
    return true;
  }
  if (destination === "/cuenta" || destination.startsWith("/cuenta/")) {
    return true;
  }
  return false;
}
