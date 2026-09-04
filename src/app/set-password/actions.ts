"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { hasSupabasePublicConfig } from "@/infrastructure/supabase/env";
import {
  persistInvitedUserPassword,
  validateSetPasswordFields,
} from "./set-password-core";

export type SetPasswordState = {
  error: string | null;
};

export async function setPasswordAction(
  _prev: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  if (!hasSupabasePublicConfig()) {
    return {
      error: "La autenticación no está configurada.",
    };
  }

  // Read raw FormData values — do not trim/modify the password.
  const passwordRaw = formData.get("password");
  const confirmRaw = formData.get("confirm");
  const password =
    typeof passwordRaw === "string" ? passwordRaw : String(passwordRaw ?? "");
  const confirm =
    typeof confirmRaw === "string" ? confirmRaw : String(confirmRaw ?? "");

  const validated = validateSetPasswordFields({ password, confirm });
  if (!validated.ok) {
    return { error: validated.error };
  }

  // User-scoped SSR client (cookie session) — never Admin/secret client.
  const supabase = await createSupabaseServerClient();
  const result = await persistInvitedUserPassword(supabase, validated.password);

  if (!result.ok) {
    if (result.unauthenticated) {
      redirect("/login?next=/set-password");
    }
    return { error: result.error };
  }

  if (String(formData.get("flow") ?? "") === "recovery") {
    // Recovery finishes with an explicit fresh login. The core flow signs back
    // in only to prove the new password works; do not retain that verification
    // session as the user's post-recovery destination.
    await supabase.auth.signOut();
    redirect("/login?reset=success");
  }

  // Invite flow keeps the historical merchant onboarding destination.
  redirect("/merchant");
}
