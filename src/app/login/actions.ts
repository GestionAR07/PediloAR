"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { hasSupabasePublicConfig } from "@/infrastructure/supabase/env";
import { getDb } from "@/infrastructure/db/client";
import { userProfiles } from "@/infrastructure/db/schema";
import { eq } from "drizzle-orm";
import { hasDatabaseConfig } from "@/infrastructure/db/env";
import { isSafeInternalPath, sanitizeInternalPath } from "@/lib/safe-redirect";

export type LoginState = {
  error: string | null;
};

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!hasSupabasePublicConfig()) {
    return {
      error:
        "La autenticación no está configurada. Revisá las variables de entorno.",
    };
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  // Password must be passed through unchanged (no trim / case changes).
  const passwordRaw = formData.get("password");
  const password =
    typeof passwordRaw === "string" ? passwordRaw : String(passwordRaw ?? "");

  if (!email || !password) {
    return { error: "Ingresá email y contraseña." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: "Credenciales inválidas. Verificá email y contraseña." };
  }

  // Soft-check suspended users when DATABASE_URL is available.
  if (hasDatabaseConfig()) {
    try {
      const db = getDb();
      const rows = await db
        .select({ status: userProfiles.status })
        .from(userProfiles)
        .where(eq(userProfiles.id, data.user.id))
        .limit(1);

      if (rows[0]?.status === "SUSPENDED") {
        await supabase.auth.signOut();
        return {
          error: "Tu cuenta está suspendida. Contactá al administrador.",
        };
      }
    } catch {
      // Profile check failure should not leak internals; allow session
      // and let protected routes re-check.
    }
  }

  const nextRaw = String(formData.get("next") ?? "").trim();
  if (isSafeInternalPath(nextRaw)) {
    redirect(sanitizeInternalPath(nextRaw));
  }

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  if (!hasSupabasePublicConfig()) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
