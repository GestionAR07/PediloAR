"use server";

import { redirect } from "next/navigation";
import { updateCustomerProfileApp } from "@/application/customer/wiring";
import { sanitizeCustomerDestination } from "@/application/customer/profile";
import { isAuthzError } from "@/server/auth/errors";

export type CustomerProfileState = { error: string | null };

export async function updateCustomerProfileAction(
  _previous: CustomerProfileState,
  formData: FormData,
): Promise<CustomerProfileState> {
  const destination = sanitizeCustomerDestination(
    String(formData.get("next") ?? ""),
  );
  try {
    const result = await updateCustomerProfileApp({
      displayName: String(formData.get("displayName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
    });
    if (!result.ok) {
      return { error: result.error.message };
    }
  } catch (error) {
    if (isAuthzError(error)) {
      redirect(`/login?next=${encodeURIComponent("/cuenta/perfil")}`);
    }
    return { error: "No pudimos guardar tus datos. Intentá nuevamente." };
  }
  redirect(destination);
}
