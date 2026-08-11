import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Auth Admin helpers for locating users without creating duplicates.
 * Encapsulates listUsers pagination — callers must not reimplement loosely.
 */

export type AuthUserLookup = {
  id: string;
  email: string | null;
  emailConfirmed: boolean;
};

const PAGE_SIZE = 200;
const MAX_PAGES = 50;

function toLookup(user: User): AuthUserLookup {
  const confirmed = Boolean(
    user.email_confirmed_at || user.confirmed_at || user.phone_confirmed_at,
  );
  return {
    id: user.id,
    email: user.email ?? null,
    emailConfirmed: confirmed,
  };
}

/**
 * Finds an Auth user by normalized email across all listUsers pages.
 * Returns null when not found. Throws on Admin API failure.
 */
export async function findAuthUserByEmail(
  admin: SupabaseClient,
  normalizedEmail: string,
): Promise<AuthUserLookup | null> {
  const target = normalizedEmail.trim().toLowerCase();
  if (!target) {
    return null;
  }

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });

    if (error) {
      throw new Error(`Auth Admin listUsers failed: ${error.message}`);
    }

    const users = data.users ?? [];
    const match = users.find(
      (user) => (user.email ?? "").trim().toLowerCase() === target,
    );
    if (match) {
      return toLookup(match);
    }

    if (users.length < PAGE_SIZE) {
      return null;
    }
  }

  return null;
}

export type InviteAuthUserInput = {
  email: string;
  displayName?: string;
  redirectTo: string;
};

/**
 * Invites a new Auth user by email (sends invite mail via Supabase).
 * Does not grant merchant authority — membership is a separate write.
 */
export async function inviteAuthUserByEmail(
  admin: SupabaseClient,
  input: InviteAuthUserInput,
): Promise<AuthUserLookup> {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(
    input.email,
    {
      redirectTo: input.redirectTo,
      data: input.displayName ? { display_name: input.displayName } : undefined,
    },
  );

  if (error || !data.user) {
    throw new Error(
      error?.message
        ? `Invite failed: ${error.message}`
        : "Invite failed: no user returned",
    );
  }

  return toLookup(data.user);
}
