import Link from "next/link";
import type { PublicMerchantPage } from "@/application/storefront/types";
import { MerchantStorefrontCover } from "@/components/storefront/merchant-storefront-cover";
import {
  BikeIcon,
  ClockIcon,
  MapPinIcon,
  StoreIcon,
} from "@/components/ui/public-icons";

type Props = {
  merchant: PublicMerchantPage;
  zoneId?: string | null;
};

function availabilityToneDot(
  tone: PublicMerchantPage["availabilityTone"],
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

type LogisticsChip = {
  id: string;
  label: string;
  icon: "store" | "bike" | "clock" | null;
  primary: boolean;
};

function buildLogisticsChips(merchant: PublicMerchantPage): LogisticsChip[] {
  return [
    merchant.logistics.pickupAvailable
      ? {
          id: "pickup",
          label: "Retiro en el comercio",
          icon: "store" as const,
          primary: true,
        }
      : null,
    merchant.logistics.deliveryAvailable
      ? {
          id: "delivery",
          label: `Envío a ${merchant.zoneName}`,
          icon: "bike" as const,
          primary: true,
        }
      : null,
    merchant.logistics.deliveryFeeLabel
      ? {
          id: "fee",
          label: merchant.logistics.deliveryFeeLabel,
          icon: null,
          primary: false,
        }
      : null,
    merchant.logistics.minimumOrderLabel
      ? {
          id: "minimum",
          label: merchant.logistics.minimumOrderLabel,
          icon: null,
          primary: false,
        }
      : null,
    merchant.logistics.estimatedMinutesLabel
      ? {
          id: "eta",
          label: merchant.logistics.estimatedMinutesLabel,
          icon: "clock" as const,
          primary: false,
        }
      : null,
    merchant.logistics.preparationMinutesLabel
      ? {
          id: "prep",
          label: merchant.logistics.preparationMinutesLabel,
          icon: "clock" as const,
          primary: false,
        }
      : null,
  ].filter((chip): chip is LogisticsChip => chip != null);
}

export function PublicMerchantHero({ merchant, zoneId = null }: Props) {
  const hoursText = merchant.hoursLabel
    ? `${merchant.hoursLabel}${merchant.hoursDetail ? ` · ${merchant.hoursDetail}` : ""}`
    : null;
  const logisticsChips = buildLogisticsChips(merchant);
  const primaryChips = logisticsChips.filter((chip) => chip.primary);
  const secondaryChips = logisticsChips.filter((chip) => !chip.primary);
  const backHref = zoneId
    ? `/?zone=${encodeURIComponent(zoneId)}#comercios`
    : "/#comercios";

  return (
    <section className="merchant-storefront-hero relative min-w-0 max-w-full overflow-x-clip bg-[var(--ps-night-900)] text-white">
      <div className="merchant-storefront-hero-atmosphere" aria-hidden />

      <div className="relative mx-auto w-full min-w-0 max-w-7xl px-4 pt-5 sm:px-6 lg:px-8 lg:pt-7">
        <p className="text-sm">
          <Link
            href={backHref}
            className="inline-flex min-h-11 items-center gap-2 text-white/85 underline-offset-4 hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            ← Volver a comercios
          </Link>
        </p>

        <div className="merchant-storefront-cover relative mt-4 isolate overflow-hidden rounded-[1.75rem] border border-white/10 shadow-glow sm:mt-5 sm:rounded-[2rem]">
          <MerchantStorefrontCover
            name={merchant.name}
            coverUrl={merchant.coverUrl}
            priority
          />
          <div className="merchant-storefront-cover-scrim" aria-hidden />
        </div>

        <div className="relative min-w-0 space-y-4 pt-6 pb-8 sm:space-y-5 sm:pt-8 sm:pb-10 lg:pb-12">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-extrabold text-white">
              <span
                className={`h-1.5 w-1.5 rounded-full ${availabilityToneDot(merchant.availabilityTone)}`}
              />
              {merchant.availabilityLabel}
            </span>
            {hoursText ? (
              <span className="glass rounded-full px-3 py-1.5 text-[11px] font-bold text-white/90">
                {hoursText}
              </span>
            ) : null}
          </div>

          <div className="min-w-0 max-w-3xl space-y-3">
            <h1 className="merchant-storefront-title font-display font-extrabold tracking-tight break-words">
              {merchant.name}
            </h1>
            <p className="inline-flex max-w-full items-center gap-2 text-sm font-medium break-words text-slate-300">
              <MapPinIcon className="h-4 w-4 shrink-0 text-violet-300" />
              <span className="min-w-0">
                {merchant.zoneName} · {merchant.cityName}
              </span>
            </p>
            {merchant.description ? (
              <p className="max-w-prose text-sm leading-relaxed break-words text-slate-300/90 sm:text-base">
                {merchant.description}
              </p>
            ) : null}
          </div>

          {primaryChips.length > 0 ? (
            <ul className="flex min-w-0 flex-wrap gap-2">
              {primaryChips.map((chip) => (
                <li
                  key={chip.id}
                  className="glass inline-flex max-w-full items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold break-words text-white"
                >
                  {chip.icon === "store" ? (
                    <StoreIcon className="h-3.5 w-3.5 shrink-0" />
                  ) : null}
                  {chip.icon === "bike" ? (
                    <BikeIcon className="h-3.5 w-3.5 shrink-0" />
                  ) : null}
                  {chip.label}
                </li>
              ))}
            </ul>
          ) : null}

          {secondaryChips.length > 0 ? (
            <ul className="flex min-w-0 flex-wrap gap-2">
              {secondaryChips.map((chip) => (
                <li
                  key={chip.id}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold break-words text-slate-200"
                >
                  {chip.icon === "clock" ? (
                    <ClockIcon className="h-3.5 w-3.5 shrink-0 text-violet-200" />
                  ) : null}
                  {chip.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="public-hero-wave" aria-hidden>
        <svg
          className="block h-10 w-full text-[var(--ps-cream)] lg:h-14"
          viewBox="0 0 1440 90"
          fill="currentColor"
          preserveAspectRatio="none"
        >
          <path d="M0 90h1440V30c-120 30-300 45-480 45S600 30 420 30 120 60 0 90z" />
        </svg>
      </div>
    </section>
  );
}
