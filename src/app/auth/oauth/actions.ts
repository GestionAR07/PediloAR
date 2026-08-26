"use server";

import { redirect } from "next/navigation";
import { appAbsoluteUrl } from "@/config/app-base-url";
import { isGoogleOAuthEnabled } from "@/config/auth-providers";
import { hasSupabasePublicConfig } from "@/infrastructure/supabase/env";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { isSafeInternalPath, sanitizeInternalPath } from "@/lib/safe-redirect";

export type GoogleOAuthState = { error: string | null };

export async function startGoogleOAuthAction(
  _previous: GoogleOAuthState,
  formData: FormData,
): Promise<GoogleOAuthState> {
  if (!isGoogleOAuthEnabled() || !hasSupabasePublicConfig()) {
    return {
      error: "El acceso con Google todavía no está disponible.",
    };
  }

  const requestedNext = String(formData.get("next") ?? "").trim();
  const nextPath = isSafeInternalPath(requestedNext)
    ? sanitizeInternalPath(requestedNext)
    : null;
  const continuePath = nextPath
    ? `/auth/oauth/continue?next=${encodeURIComponent(nextPath)}`
    : "/auth/oauth/continue";

  let redirectTo: string;
  try {
    redirectTo = appAbsoluteUrl(
      `/auth/confirm?next=${encodeURIComponent(continuePath)}`,
    );
  } catch {
    return {
      error: "La URL pública de Pedilo no está configurada.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) {
    return {
      error: "No pudimos iniciar el acceso con Google. Intentá nuevamente.",
    };
  }

  redirect(data.url);
}
