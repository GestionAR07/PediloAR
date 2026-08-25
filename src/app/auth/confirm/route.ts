import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import {
  getSupabasePublicConfig,
  hasSupabasePublicConfig,
} from "@/infrastructure/supabase/env";
import { sanitizeInternalPath } from "@/lib/safe-redirect";

/**
 * Email confirmation / invite / recovery callback (SSR).
 *
 * Accepts token_hash + type from Supabase templates. Establishes session
 * cookies on the redirect response, then redirects to an internal path only
 * (default: /set-password).
 *
 * IMPORTANT: cookies must be written onto the NextResponse.redirect we return.
 * Using cookies() from next/headers and then returning a fresh
 * NextResponse.redirect can drop Set-Cookie headers — the invite session
 * would appear to work only intermittently, and updateUser/signInWithPassword
 * would not see a coherent authenticated session.
 *
 * Recovery (type=recovery) is accepted here so a correctly configured Reset
 * Password template can reach /set-password, but the app still does not ship
 * a full password-recovery product flow (PASSWORD_RECOVERY_NOT_IMPLEMENTED).
 */
export async function GET(request: NextRequest) {
  if (!hasSupabasePublicConfig()) {
    return NextResponse.redirect(
      new URL("/login?error=auth_config", request.url),
    );
  }

  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = sanitizeInternalPath(searchParams.get("next"), "/set-password");

  if (!code && (!token_hash || !type)) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_token", request.url),
    );
  }

  // Allow only known Auth email OTP types for this route.
  const allowedTypes = new Set([
    "invite",
    "signup",
    "magiclink",
    "recovery",
    "email",
    "email_change",
  ]);
  if (!code && (!type || !allowedTypes.has(type))) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_token", request.url),
    );
  }

  const redirectUrl = new URL(next, request.url);
  let response = NextResponse.redirect(redirectUrl);

  const { url, publishableKey } = getSupabasePublicConfig();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        // Recreate redirect so Set-Cookie lands on the response we return.
        response = NextResponse.redirect(redirectUrl);
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        type: type as
          | "invite"
          | "signup"
          | "magiclink"
          | "recovery"
          | "email"
          | "email_change",
        token_hash: token_hash!,
      });

  if (error) {
    return NextResponse.redirect(
      new URL("/login?error=expired_token", request.url),
    );
  }

  return response;
}
