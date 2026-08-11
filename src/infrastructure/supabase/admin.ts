import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabasePublicConfig,
  getSupabaseSecretKey,
  hasSupabasePublicConfig,
  hasSupabaseSecretKey,
} from "./env";

/**
 * Supabase Admin client (Auth Admin API).
 *
 * - Lazy factory: import is safe without a secret present.
 * - NEVER reuse the SSR cookie client.
 * - Authorization of the human caller is separate (requirePlatformAdmin first).
 * - Never pass this client to Client Components or log the secret.
 */

let cached: SupabaseClient | undefined;

export function canCreateSupabaseAdminClient(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return hasSupabasePublicConfig(env) && hasSupabaseSecretKey(env);
}

/**
 * Returns a process-wide admin client. Throws if secret/public config missing.
 * Session persistence disabled — this is not a user session client.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  if (cached) {
    return cached;
  }

  const { url } = getSupabasePublicConfig();
  const secretKey = getSupabaseSecretKey();

  cached = createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return cached;
}

/** Test helper: drop cached client. */
export function __resetSupabaseAdminClientForTests(): void {
  cached = undefined;
}
