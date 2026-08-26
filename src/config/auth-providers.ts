/**
 * Public feature switches for OAuth providers.
 *
 * Provider credentials remain exclusively in the provider consoles and
 * Supabase Dashboard. These flags only control whether Pedilo exposes a
 * provider that has already been configured.
 */
export type AuthProviderEnv = Readonly<Record<string, string | undefined>>;

export function isGoogleOAuthEnabled(
  env: AuthProviderEnv = process.env,
): boolean {
  return env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED?.trim().toLowerCase() === "true";
}
