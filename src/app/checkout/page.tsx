import type { Metadata } from "next";
import { getPublicNavContextApp } from "@/application/storefront/wiring";
import { CheckoutPageClient } from "@/components/checkout/checkout-page-client";
import { PublicHeader } from "@/components/storefront/public-header";
import { APP_NAME } from "@/lib/app-info";
import { redirect } from "next/navigation";
import { requireActiveUser } from "@/server/auth/authorization";
import { isAuthzError } from "@/server/auth/errors";
import {
  customerProfileHref,
  hasCompleteCustomerContact,
} from "@/application/customer/profile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Checkout · ${APP_NAME}`,
  description: "Revisá y confirmá tu pedido.",
};

export default async function CheckoutPage() {
  let account;
  try {
    account = await requireActiveUser();
  } catch (error) {
    if (isAuthzError(error)) {
      redirect("/login?next=/checkout");
    }
    throw error;
  }
  if (!hasCompleteCustomerContact(account.profile)) {
    redirect(customerProfileHref("/checkout", true));
  }
  const nav = await getPublicNavContextApp();

  return (
    <main className="flex flex-1 flex-col">
      <PublicHeader nav={nav} />
      <CheckoutPageClient
        initialCustomer={{
          name: account.profile.displayName ?? "",
          phone: account.profile.phone ?? "",
        }}
      />
    </main>
  );
}
