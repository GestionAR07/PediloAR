/**
 * Public Supabase client configuration (URL + publishable key only).
 * Secret/admin key lives in separate helpers — never NEXT_PUBLIC_*.
 */

export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

export type EnvLike = Readonly<Record<string, string | undefined>>;

export function hasSupabasePublicConfig(env: EnvLike = process.env): boolean {
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );
}

export function getSupabasePublicConfig(
  env: EnvLike = process.env,
): SupabasePublicConfig {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error(
      "Missing Supabase public config. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
    );
  }

  if (publishableKey.includes("service_role") || url.includes("service_role")) {
    throw new Error(
      "Refusing to use a service-role credential as the public Supabase key",
    );
  }

  return { url, publishableKey };
}

export function hasSupabaseSecretKey(env: EnvLike = process.env): boolean {
  return Boolean(env.SUPABASE_SECRET_KEY?.trim());
}

/**
 * Server-only secret for Auth Admin API.
 * Never log the return value. Never expose as NEXT_PUBLIC_*.
 */
export function getSupabaseSecretKey(env: EnvLike = process.env): string {
  if (env.NEXT_PUBLIC_SUPABASE_SECRET_KEY?.trim()) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_SECRET_KEY is forbidden. Use SUPABASE_SECRET_KEY (server-only).",
    );
  }

  const secretKey = env.SUPABASE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY is required for Auth Admin operations. Set it in .env.local (never NEXT_PUBLIC_*).",
    );
  }

  return secretKey;
}
