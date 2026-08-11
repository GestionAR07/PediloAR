/**
 * Public Supabase client configuration (URL + publishable key only).
 * Never accept secret/service keys here.
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
