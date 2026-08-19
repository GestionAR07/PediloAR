import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPublicMerchantCatalogApp,
  getPublicNavContextApp,
} from "@/application/storefront/wiring";
import { MerchantCatalogClient } from "@/components/storefront/merchant-catalog-client";
import { PublicHeader } from "@/components/storefront/public-header";
import {
  BikeIcon,
  ClockIcon,
  MapPinIcon,
  StoreIcon,
} from "@/components/ui/public-icons";
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

function availabilityToneDot(
  tone: "available" | "paused" | "unavailable",
): string {
  switch (tone) {
    case "available":
      return "bg-green-400";
    case "paused":
      return "bg-amber-400";
    case "unavailable":
      return "bg-slate-300";
  }
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

  const initial = merchant.name.slice(0, 1).toUpperCase();
  const hoursText = merchant.hoursLabel
    ? `${merchant.hoursLabel}${merchant.hoursDetail ? ` · ${merchant.hoursDetail}` : ""}`
    : null;
  const logisticsChips = [
    merchant.logistics.pickupAvailable
      ? {
          id: "pickup",
          label: "Retiro en el comercio",
          icon: "store" as const,
        }
      : null,
    merchant.logistics.deliveryAvailable
      ? {
          id: "delivery",
          label: `Envío a ${merchant.zoneName}`,
          icon: "bike" as const,
        }
      : null,
    merchant.logistics.deliveryFeeLabel
      ? {
          id: "fee",
          label: merchant.logistics.deliveryFeeLabel,
          icon: null,
        }
      : null,
    merchant.logistics.minimumOrderLabel
      ? {
          id: "minimum",
          label: merchant.logistics.minimumOrderLabel,
          icon: null,
        }
      : null,
    merchant.logistics.estimatedMinutesLabel
      ? {
          id: "eta",
          label: merchant.logistics.estimatedMinutesLabel,
          icon: "clock" as const,
        }
      : null,
    merchant.logistics.preparationMinutesLabel
      ? {
          id: "prep",
          label: merchant.logistics.preparationMinutesLabel,
          icon: "clock" as const,
        }
      : null,
  ].filter((chip) => chip != null);

  return (
    <main className="flex flex-1 flex-col">
      <PublicHeader
        nav={nav}
        zoneLabel={`${merchant.zoneName} · ${merchant.cityName}`}
      />

      <section className="relative overflow-hidden bg-[var(--ps-night-900)] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-fuchsia-600/30 blur-[130px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/3 -right-32 h-[460px] w-[460px] rounded-full bg-violet-600/30 blur-[130px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 left-1/3 h-[420px] w-[420px] rounded-full bg-orange-500/20 blur-[130px]"
        />

        <div className="relative mx-auto max-w-7xl px-4 pt-6 pb-8 sm:px-6 lg:px-8 lg:pt-8 lg:pb-10">
          <p className="text-sm">
            <Link
              href={zone ? `/?zone=${encodeURIComponent(zone)}` : "/"}
              className="inline-flex items-center gap-2 text-white/80 underline-offset-4 hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              ← Volver al marketplace
            </Link>
          </p>

          <div className="mt-6 flex flex-col gap-5 sm:mt-8 sm:flex-row sm:items-start sm:gap-6">
            <div
              aria-hidden
              className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-violet-800 via-violet-600 to-violet-500 shadow-glow sm:h-28 sm:w-28"
            >
              <span className="absolute -right-6 -bottom-8 h-20 w-20 rounded-full bg-fuchsia-500/25 blur-2xl" />
              <span className="font-display relative text-4xl font-extrabold text-white/90">
                {initial}
              </span>
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="glass inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold text-white">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${availabilityToneDot(merchant.availabilityTone)}`}
                  />
                  {merchant.availabilityLabel}
                </span>
                {hoursText ? (
                  <span className="glass rounded-full px-2.5 py-1 text-[11px] font-bold text-white/90">
                    {hoursText}
                  </span>
                ) : null}
              </div>

              <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                {merchant.name}
              </h1>

              <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-300">
                <MapPinIcon className="h-4 w-4 text-violet-300" />
                {merchant.zoneName} · {merchant.cityName}
              </p>

              {merchant.description ? (
                <p className="max-w-prose text-sm text-slate-300/90 sm:text-base">
                  {merchant.description}
                </p>
              ) : null}
            </div>
          </div>

          {logisticsChips.length > 0 ? (
            <ul className="mt-6 flex flex-wrap gap-2">
              {logisticsChips.map((chip) => (
                <li
                  key={chip.id}
                  className="glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold text-white"
                >
                  {chip.icon === "store" ? (
                    <StoreIcon className="h-3.5 w-3.5" />
                  ) : null}
                  {chip.icon === "bike" ? (
                    <BikeIcon className="h-3.5 w-3.5" />
                  ) : null}
                  {chip.icon === "clock" ? (
                    <ClockIcon className="h-3.5 w-3.5 text-violet-200" />
                  ) : null}
                  {chip.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <svg
          className="relative block h-10 w-full text-[var(--ps-cream)] lg:h-14"
          viewBox="0 0 1440 90"
          fill="currentColor"
          aria-hidden
          preserveAspectRatio="none"
        >
          <path d="M0 90h1440V30c-120 30-300 45-480 45S600 30 420 30 120 60 0 90z" />
        </svg>
      </section>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {merchant.paymentMethods.length > 0 ? (
          <section className="space-y-3 rounded-[2rem] border border-violet-100/70 bg-white p-6 shadow-soft sm:p-8">
            <p className="text-xs font-extrabold tracking-wide text-slate-500 uppercase">
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

        <section className="space-y-5">
          <div className="space-y-1">
            <p className="mb-2 text-xs font-extrabold tracking-[0.2em] text-fuchsia-600">
              CATÁLOGO
            </p>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-[var(--ps-night-900)] lg:text-4xl">
              Catálogo
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
