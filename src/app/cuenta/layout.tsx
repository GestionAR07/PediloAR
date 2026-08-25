import type { ReactNode } from "react";
import { getPublicNavContextApp } from "@/application/storefront/wiring";
import { CustomerAccountNav } from "@/components/customer/customer-account-nav";
import { PublicHeader } from "@/components/storefront/public-header";

export const dynamic = "force-dynamic";

export default async function CustomerAccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const nav = await getPublicNavContextApp();
  return (
    <main className="flex flex-1 flex-col">
      <PublicHeader nav={nav} />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <CustomerAccountNav />
        <div className="mt-7">{children}</div>
      </div>
    </main>
  );
}
