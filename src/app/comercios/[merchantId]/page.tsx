import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPublicMerchantCatalogApp,
  getPublicNavContextApp,
} from "@/application/storefront/wiring";
import { MerchantCatalogClient } from "@/components/storefront/merchant-catalog-client";
import { PublicHeader } from "@/components/storefront/public-header";
import { PublicMerchantHero } from "@/components/storefront/public-merchant-hero";
import { APP_NAME } from "@/lib/app-info";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ merchantId: string }>;
  searchParams: Promise<{ zone?: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { merchantId } = await params;
  const merchant = await getPublicMerchantCatalogApp(merchantId, null);
  if (!merchant) {
    return { title: `Comercio · ${APP_NAME}` };
  }
  return {
    title: `${merchant.name} · ${APP_NAME}`,
    description:
      merchant.description.trim() ||
      `Productos de ${merchant.name} en ${merchant.zoneName}.`,
  };
}

export default async function PublicMerchantPage({
  params,
  searchParams,
}: PageProps) {
  const { merchantId } = await params;
  const { zone } = await searchParams;
  const [nav, merchant] = await Promise.all([
    getPublicNavContextApp(),
    getPublicMerchantCatalogApp(merchantId, zone),
  ]);

  if (!merchant) {
    notFound();
  }

  return (
    <main className="flex min-w-0 max-w-full flex-1 flex-col">
      <PublicHeader
        nav={nav}
        zoneLabel={`${merchant.zoneName} · ${merchant.cityName}`}
      />

      <PublicMerchantHero merchant={merchant} zoneId={zone ?? null} />

      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {merchant.paymentMethods.length > 0 ? (
          <section className="min-w-0 space-y-3 rounded-[2rem] border border-violet-100/70 bg-white p-6 shadow-soft sm:p-8">
            <p className="text-xs font-extrabold tracking-wide break-words text-slate-500 uppercase">
              Medios de pago (directo al comercio)
            </p>
            <ul className="flex flex-wrap gap-2">
              {merchant.paymentMethods.map((method) => (
                <li
                  key={method.code}
                  className="rounded-full bg-violet-100 px-3.5 py-1.5 text-xs font-extrabold text-violet-700"
                  title={method.instructions ?? undefined}
                >
                  {method.label}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="min-w-0 space-y-6">
          <div className="min-w-0 max-w-full space-y-1">
            <p className="mb-2 text-xs font-extrabold tracking-[0.2em] break-words text-orange-500">
              PRODUCTOS
            </p>
            <h2 className="font-display text-2xl font-extrabold tracking-tight break-words text-[var(--ps-night-900)] lg:text-4xl">
              Elegí lo que necesitás
            </h2>
          </div>
          <MerchantCatalogClient
            merchantId={merchant.id}
            merchantName={merchant.name}
            categories={merchant.categories}
            products={merchant.products}
          />
        </section>
      </div>
    </main>
  );
}
