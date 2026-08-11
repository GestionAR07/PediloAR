import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "./env";

/**
 * Browser Supabase client for Client Components only.
 * Uses the publishable key — never a secret key.
 */
export function createSupabaseBrowserClient() {
  const { url, publishableKey } = getSupabasePublicConfig();
  return createBrowserClient(url, publishableKey);
}
