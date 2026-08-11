import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { hasSupabasePublicConfig } from "@/infrastructure/supabase/env";
import { sanitizeInternalPath } from "@/lib/safe-redirect";

/**
 * Email confirmation / invite callback (SSR).
 * Accepts token_hash + type from Supabase templates. Establishes session cookies
 * then redirects to an internal path only (default: /set-password).
 */
export async function GET(request: NextRequest) {
  if (!hasSupabasePublicConfig()) {
    return NextResponse.redirect(
      new URL("/login?error=auth_config", request.url),
    );
  }

  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = sanitizeInternalPath(searchParams.get("next"), "/set-password");

  if (!token_hash || !type) {
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
  if (!allowedTypes.has(type)) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_token", request.url),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    type: type as
      "invite" | "signup" | "magiclink" | "recovery" | "email" | "email_change",
    token_hash,
  });

  if (error) {
    return NextResponse.redirect(
      new URL("/login?error=expired_token", request.url),
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
