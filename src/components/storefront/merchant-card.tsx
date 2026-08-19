import Link from "next/link";
import type { PublicMerchantCard } from "@/application/storefront/types";
import { BikeIcon, ClockIcon } from "@/components/ui/public-icons";

type Props = {
  merchant: PublicMerchantCard;
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

export function MerchantCard({ merchant }: Props) {
  const initial = merchant.name.slice(0, 1).toUpperCase();
  const { logistics } = merchant;
  const hasFulfillment =
    logistics.pickupAvailable || logistics.deliveryAvailable;

  return (
    <Link
      href={merchant.href}
      className="card-lift group block cursor-pointer overflow-hidden rounded-[1.75rem] border border-violet-100/70 bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]"
    >
      <div className="relative h-44 overflow-hidden bg-gradient-to-br from-violet-200 to-fuchsia-200">
        <div
          aria-hidden
          className="zoom-img absolute inset-0 bg-gradient-to-br from-violet-800 via-violet-600 to-fuchsia-500"
        />
        <span
          aria-hidden
          className="absolute -right-8 -bottom-10 h-28 w-28 rounded-full bg-fuchsia-500/25 blur-2xl"
        />
        <span className="font-display absolute inset-0 flex items-center justify-center text-4xl font-extrabold text-white/90">
          {initial}
        </span>
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--ps-night)]/60 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-white uppercase backdrop-blur">
          <span
            className={`h-1.5 w-1.5 rounded-full ${toneDot(merchant.availabilityTone)}`}
          />
          {merchant.availabilityLabel}
        </span>
      </div>
      <div className="p-5">
        <h3 className="font-display text-lg leading-tight font-extrabold tracking-tight text-[var(--ps-night-900)]">
          {merchant.name}
        </h3>
        <p className="mt-1 text-xs font-bold tracking-wider text-slate-400 uppercase">
          {merchant.zoneName}
        </p>
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
