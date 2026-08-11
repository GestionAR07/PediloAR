"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { hasSupabasePublicConfig } from "@/infrastructure/supabase/env";

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

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!password || !confirm) {
    return { error: "Completá ambos campos de contraseña." };
  }

  if (password !== confirm) {
    return { error: "Las contraseñas no coinciden." };
  }

  if (password.length < 8) {
    return {
      error: "La contraseña debe tener al menos 8 caracteres.",
    };
  }

  if (password.length > 72) {
    return { error: "La contraseña es demasiado larga." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login?next=/set-password");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      error:
        "No se pudo actualizar la contraseña. Verificá los requisitos e intentá de nuevo.",
    };
  }

  redirect("/merchant");
}
