import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "./env";

type BrowserClient = ReturnType<typeof createBrowserClient>;

let cached: BrowserClient | undefined;

/**
 * Browser Supabase client for Client Components only.
 * Uses the publishable key — never a secret key.
 * Cached so Realtime channels share one authenticated client.
 */
export function createSupabaseBrowserClient() {
  if (cached) {
    return cached;
  }

  const { url, publishableKey } = getSupabasePublicConfig();
  cached = createBrowserClient(url, publishableKey);
  return cached;
}

/** Test helper: drop cached client. */
export function __resetSupabaseBrowserClientForTests(): void {
  cached = undefined;
}
