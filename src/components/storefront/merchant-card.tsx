import Link from "next/link";
import type { PublicMerchantCard } from "@/application/storefront/types";
import { BikeIcon, ClockIcon } from "@/components/ui/public-icons";

type Props = {
  merchant: PublicMerchantCard;
};

function toneClass(tone: PublicMerchantCard["availabilityTone"]): string {
  switch (tone) {
    case "available":
      return "bg-emerald-50 text-emerald-800";
    case "paused":
      return "bg-amber-50 text-amber-900";
    case "unavailable":
      return "bg-neutral-100 text-muted";
  }
}

export function MerchantCard({ merchant }: Props) {
  const initial = merchant.name.slice(0, 1).toUpperCase();
  const { logistics } = merchant;
  const hasFulfillment =
    logistics.pickupAvailable || logistics.deliveryAvailable;
  const detailBits = [
    logistics.deliveryFeeLabel,
    logistics.minimumOrderLabel,
    logistics.estimatedMinutesLabel,
  ].filter((value): value is string => Boolean(value));

  return (
    <Link
      href={merchant.href}
      className="card-lift group block overflow-hidden rounded-[1.75rem] border border-violet-100/70 bg-white shadow-soft motion-safe:transition motion-safe:duration-300 motion-safe:hover:-translate-y-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]"
    >
      <div
        aria-hidden
        className="relative flex h-40 items-center justify-center bg-gradient-to-br from-violet-800 via-violet-600 to-violet-500"
      >
        <span
          aria-hidden
          className="absolute -right-8 -bottom-10 h-28 w-28 rounded-full bg-fuchsia-500/20 blur-2xl"
        />
        <span className="font-display relative text-4xl font-extrabold text-white/90">
          {initial}
        </span>
        <span
          className={`absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${toneClass(merchant.availabilityTone)}`}
        >
          {merchant.availabilityLabel}
        </span>
      </div>
      <div className="space-y-2 p-5">
        <h3 className="font-display text-lg font-extrabold leading-tight tracking-tight text-[var(--ps-night-900)]">
          {merchant.name}
        </h3>
        <p className="text-xs font-bold uppercase tracking-wider text-muted">
          {merchant.zoneName}
        </p>
        {merchant.hoursLabel ? (
          <p className="text-xs text-muted">
            {merchant.hoursLabel}
            {merchant.hoursDetail ? ` · ${merchant.hoursDetail}` : ""}
          </p>
        ) : null}
        {hasFulfillment ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {logistics.pickupAvailable ? (
              <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
                Retiro
              </span>
            ) : null}
            {logistics.deliveryAvailable ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
                <BikeIcon className="h-3.5 w-3.5" />
                Envío
              </span>
            ) : null}
          </div>
        ) : null}
        {detailBits.length > 0 ? (
          <div className="space-y-0.5 pt-0.5 text-xs text-muted">
            {logistics.deliveryFeeLabel ? (
              <p>{logistics.deliveryFeeLabel}</p>
            ) : null}
            {logistics.minimumOrderLabel ? (
              <p>{logistics.minimumOrderLabel}</p>
            ) : null}
            {logistics.estimatedMinutesLabel ? (
              <p className="inline-flex items-center gap-1.5">
                <ClockIcon className="h-3.5 w-3.5 text-violet-500" />
                {logistics.estimatedMinutesLabel}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
