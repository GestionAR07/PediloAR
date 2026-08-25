import { redirect } from "next/navigation";
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
