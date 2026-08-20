"use client";

import { useState } from "react";
import Link from "next/link";
import type { PublicMerchantCard } from "@/application/storefront/types";
import { MerchantCoverFallback } from "@/components/storefront/merchant-cover-fallback";
import { BikeIcon, ClockIcon } from "@/components/ui/public-icons";
import { merchantCardHref } from "@/lib/filter-public-merchants";

type Props = {
  merchant: PublicMerchantCard;
  zoneId?: string | null;
};

function toneDot(tone: PublicMerchantCard["availabilityTone"]): string {
  switch (tone) {
    case "available":
      return "bg-green-400";
    case "paused":
      return "bg-amber-400";
    case "unavailable":
      return "bg-slate-300";
  }
}

function MerchantCover({
  name,
  coverUrl,
}: {
  name: string;
  coverUrl: string | null;
}) {
  const [failed, setFailed] = useState(false);
  if (!coverUrl || failed) {
    return <MerchantCoverFallback name={name} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={coverUrl}
      alt={`Portada de ${name}`}
      loading="lazy"
      className="zoom-img h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export function MerchantCard({ merchant, zoneId = null }: Props) {
  const { logistics } = merchant;
  const hasFulfillment =
    logistics.pickupAvailable || logistics.deliveryAvailable;
  const description = merchant.description.trim();
  const href = merchantCardHref(merchant.href, zoneId);

  return (
    <Link
      href={href}
      className="card-lift group block h-full max-w-full min-w-0 cursor-pointer overflow-hidden rounded-[1.75rem] border border-violet-100/70 bg-white shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]"
    >
      <div className="relative isolate h-48 overflow-hidden bg-gradient-to-br from-violet-200 to-fuchsia-200 sm:h-52">
        <MerchantCover name={merchant.name} coverUrl={merchant.coverUrl} />
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--ps-night)]/60 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-white uppercase backdrop-blur">
          <span
            className={`h-1.5 w-1.5 rounded-full ${toneDot(merchant.availabilityTone)}`}
          />
          {merchant.availabilityLabel}
        </span>
      </div>
      <div className="flex flex-col gap-1 p-5 sm:p-6">
        <h3 className="font-display text-lg leading-tight font-extrabold tracking-tight break-words text-[var(--ps-night-900)] sm:text-xl">
          {merchant.name}
        </h3>
        <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
          {merchant.zoneName}
        </p>
        {description ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted">{description}</p>
        ) : null}
        {merchant.hoursLabel ? (
          <p className="mt-1 text-xs text-muted">
            {merchant.hoursLabel}
            {merchant.hoursDetail ? ` · ${merchant.hoursDetail}` : ""}
          </p>
        ) : null}
        {hasFulfillment || logistics.estimatedMinutesLabel ? (
          <div className="mt-3.5 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-600">
            {logistics.estimatedMinutesLabel ? (
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon className="h-4 w-4 text-fuchsia-500" />
                {logistics.estimatedMinutesLabel}
              </span>
            ) : null}
            {logistics.deliveryAvailable ? (
              <span className="inline-flex items-center gap-1.5">
                <BikeIcon className="h-4 w-4 text-lime-600" />
                {logistics.deliveryFeeLabel ?? "Envío"}
              </span>
            ) : null}
            {logistics.pickupAvailable ? (
              <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
                Retiro
              </span>
            ) : null}
          </div>
        ) : null}
        {logistics.minimumOrderLabel ? (
          <p className="mt-1.5 text-xs text-muted">
            {logistics.minimumOrderLabel}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
