"use server";

import { appAbsoluteUrl, hasAppBaseUrl } from "@/config/app-base-url";
import { hasSupabasePublicConfig } from "@/infrastructure/supabase/env";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export type ForgotPasswordState = {
  error: string | null;
  success: string | null;
};

const SUCCESS_MESSAGE =
  "Si existe una cuenta con ese email, te enviamos un enlace para restablecer la contraseña.";

function normalizeEmail(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim().toLowerCase();
}

function isPlausibleEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function requestPasswordResetAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = normalizeEmail(formData.get("email"));
  if (!isPlausibleEmail(email)) {
    return {
      error: "Ingresá un email válido.",
      success: null,
    };
  }

  if (!hasSupabasePublicConfig() || !hasAppBaseUrl()) {
    return {
      error: "La recuperación de contraseña no está disponible en este entorno.",
      success: null,
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const redirectTo = appAbsoluteUrl(
      "/auth/confirm?type=recovery&next=/set-password",
    );
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      return {
        error: "No pudimos procesar la solicitud. Intentá nuevamente más tarde.",
        success: null,
      };
    }

    return { error: null, success: SUCCESS_MESSAGE };
  } catch {
    return {
      error: "No pudimos procesar la solicitud. Intentá nuevamente más tarde.",
      success: null,
    };
  }
}
