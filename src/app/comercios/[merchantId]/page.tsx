import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPublicMerchantCatalogApp,
  getPublicNavContextApp,
} from "@/application/storefront/wiring";
import { MerchantCatalogClient } from "@/components/storefront/merchant-catalog-client";
import { PublicHeader } from "@/components/storefront/public-header";
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
      `Catálogo de ${merchant.name} en ${merchant.zoneName}.`,
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

  const logisticsBits = [
    merchant.logistics.pickupAvailable ? "Retiro en el comercio" : null,
    merchant.logistics.deliveryAvailable
      ? `Envío a ${merchant.zoneName}`
      : null,
    merchant.logistics.deliveryFeeLabel,
    merchant.logistics.minimumOrderLabel,
    merchant.logistics.estimatedMinutesLabel,
    merchant.logistics.preparationMinutesLabel,
  ].filter(Boolean);

  return (
    <main className="flex flex-1 flex-col gap-6 border-t border-border pt-8">
      <PublicHeader
        nav={nav}
        zoneLabel={`${merchant.zoneName} · ${merchant.cityName}`}
      />

      <p className="text-sm">
        <Link
          href={zone ? `/?zone=${encodeURIComponent(zone)}` : "/"}
          className="text-accent underline-offset-4 hover:underline"
        >
          ← Volver al marketplace
        </Link>
      </p>

      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {merchant.name}
            </h1>
            <p className="text-sm text-muted">
              {merchant.zoneName} · {merchant.cityName}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              merchant.availabilityTone === "available"
                ? "bg-accent/10 text-accent"
                : merchant.availabilityTone === "paused"
                  ? "bg-amber-50 text-amber-900"
                  : "bg-neutral-100 text-muted"
            }`}
          >
            {merchant.availabilityLabel}
          </span>
        </div>

        {merchant.description ? (
          <p className="max-w-prose text-sm text-muted">
            {merchant.description}
          </p>
        ) : null}

        {merchant.hoursLabel ? (
          <p className="text-sm text-muted">
            {merchant.hoursLabel}
            {merchant.hoursDetail ? ` · ${merchant.hoursDetail}` : ""}
          </p>
        ) : null}

        {logisticsBits.length > 0 ? (
          <p className="text-sm text-foreground/90">
            {logisticsBits.join(" · ")}
          </p>
        ) : null}

        {merchant.paymentMethods.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Medios de pago (directo al comercio)
            </p>
            <ul className="flex flex-wrap gap-2">
              {merchant.paymentMethods.map((method) => (
                <li
                  key={method.label}
                  className="rounded-full border border-border bg-white/70 px-3 py-1 text-xs"
                  title={method.instructions ?? undefined}
                >
                  {method.label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Catálogo</h2>
        <MerchantCatalogClient
          categories={merchant.categories}
          products={merchant.products}
        />
      </section>
    </main>
  );
}
