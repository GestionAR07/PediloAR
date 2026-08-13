import type { Metadata } from "next";
import { getPublicNavContextApp } from "@/application/storefront/wiring";
import { CheckoutPageClient } from "@/components/checkout/checkout-page-client";
import { PublicHeader } from "@/components/storefront/public-header";
import { APP_NAME } from "@/lib/app-info";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Checkout · ${APP_NAME}`,
  description: "Revisá y confirmá tu pedido.",
};

export default async function CheckoutPage() {
  const nav = await getPublicNavContextApp();

  return (
    <main className="flex flex-1 flex-col gap-6 border-t border-border pt-8">
      <PublicHeader nav={nav} />
      <CheckoutPageClient />
    </main>
  );
}
