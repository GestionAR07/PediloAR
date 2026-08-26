import { redirect } from "next/navigation";
import {
  customerProfileHref,
  hasCompleteCustomerContact,
  type CustomerContactProfile,
} from "@/application/customer/profile";
import { isAuthzError } from "@/server/auth/errors";

export async function loadCustomerPage<T>(
  loader: () => Promise<T>,
): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    if (isAuthzError(error)) {
      if (error.code === "UNAUTHENTICATED" || error.code === "CONFIG_MISSING") {
        redirect("/login?next=/cuenta");
      }
      redirect("/login?error=forbidden");
    }
    throw error;
  }
}

type CustomerPageWithContext = {
  context: { profile: CustomerContactProfile };
};

/**
 * Account routes other than profile completion require usable order contact.
 * This keeps first-time OAuth users inside the completion flow even if an
 * external provider falls back directly to an account URL.
 */
export async function loadCompleteCustomerPage<
  T extends CustomerPageWithContext,
>(loader: () => Promise<T>, destination: string): Promise<T> {
  const result = await loadCustomerPage(loader);
  if (!hasCompleteCustomerContact(result.context.profile)) {
    redirect(customerProfileHref(destination, true));
  }
  return result;
}
