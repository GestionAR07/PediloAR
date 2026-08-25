"use server";

import { redirect } from "next/navigation";
import { appAbsoluteUrl } from "@/config/app-base-url";
import {
  parseCustomerNameSnapshot,
  parseCustomerPhoneSnapshot,
} from "@/domain/order/contact";
import { hasSupabasePublicConfig } from "@/infrastructure/supabase/env";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { sanitizeInternalPath } from "@/lib/safe-redirect";

export type RegisterState = {
  error: string | null;
  success: string | null;
};

export async function registerCustomerAction(
  _previous: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  if (!hasSupabasePublicConfig()) {
    return {
      error: "La autenticación no está configurada en este entorno.",
      success: null,
    };
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const passwordRaw = formData.get("password");
  const password =
    typeof passwordRaw === "string" ? passwordRaw : String(passwordRaw ?? "");
  const passwordConfirmationRaw = formData.get("passwordConfirmation");
  const passwordConfirmation =
    typeof passwordConfirmationRaw === "string"
      ? passwordConfirmationRaw
      : String(passwordConfirmationRaw ?? "");
  const name = parseCustomerNameSnapshot(
    String(formData.get("displayName") ?? ""),
  );
  const phone = parseCustomerPhoneSnapshot(String(formData.get("phone") ?? ""));
  const nextPath = sanitizeInternalPath(
    String(formData.get("next") ?? ""),
    "/cuenta",
  );

  if (!email || !email.includes("@")) {
    return { error: "Ingresá un email válido.", success: null };
  }
  if (!name.ok || !phone.ok) {
    return {
      error: "Revisá tu nombre y teléfono.",
      success: null,
    };
  }
  if (password.length < 8 || password.length > 72) {
    return {
      error: "La contraseña debe tener entre 8 y 72 caracteres.",
      success: null,
    };
  }
  if (password !== passwordConfirmation) {
    return { error: "Las contraseñas no coinciden.", success: null };
  }

  let emailRedirectTo: string;
  try {
    emailRedirectTo = appAbsoluteUrl(
      `/auth/confirm?next=${encodeURIComponent(nextPath)}`,
    );
  } catch {
    return {
      error: "La URL pública de la aplicación no está configurada.",
      success: null,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: {
        display_name: name.value,
        phone: phone.value,
      },
    },
  });

  if (error) {
    return {
      error:
        "No pudimos crear la cuenta. Verificá los datos o intentá ingresar.",
      success: null,
    };
  }
  if (data.session && data.user) {
    redirect(nextPath);
  }

  return {
    error: null,
    success:
      "Te enviamos un email de confirmación. Abrilo para activar tu cuenta.",
  };
}
