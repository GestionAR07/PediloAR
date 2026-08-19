import type { Metadata } from "next";
import { getPublicNavContextApp } from "@/application/storefront/wiring";
import { CartPageClient } from "@/components/cart/cart-page-client";
import { PublicHeader } from "@/components/storefront/public-header";
import { APP_NAME } from "@/lib/app-info";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Carrito · ${APP_NAME}`,
  description: "Revisá tu carrito local antes de continuar.",
};

export default async function CartPage() {
  const nav = await getPublicNavContextApp();

  return (
    <main className="flex flex-1 flex-col">
      <PublicHeader nav={nav} />
      <CartPageClient />
    </main>
  );
}
