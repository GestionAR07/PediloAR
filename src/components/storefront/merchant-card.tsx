import Link from "next/link";
import type { PublicMerchantCard } from "@/application/storefront/types";

type Props = {
  merchant: PublicMerchantCard;
};

function toneClass(tone: PublicMerchantCard["availabilityTone"]): string {
  switch (tone) {
    case "available":
      return "bg-accent/10 text-accent";
    case "paused":
      return "bg-amber-50 text-amber-900";
    case "unavailable":
      return "bg-neutral-100 text-muted";
  }
}

export function MerchantCard({ merchant }: Props) {
  const logisticsBits = [
    merchant.logistics.pickupAvailable ? "Retiro" : null,
    merchant.logistics.deliveryAvailable ? "Envío" : null,
    merchant.logistics.deliveryFeeLabel,
    merchant.logistics.minimumOrderLabel,
    merchant.logistics.estimatedMinutesLabel,
  ].filter(Boolean);

  return (
    <Link
      href={merchant.href}
      className="block rounded-xl border border-border bg-white/70 p-4 transition hover:border-accent/40"
    >
      <div className="flex gap-3">
        <div
          aria-hidden
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(145deg,#e8efe9,#f7f6f3)] text-sm font-semibold text-accent"
        >
          {merchant.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-base font-semibold tracking-tight">
              {merchant.name}
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${toneClass(merchant.availabilityTone)}`}
            >
              {merchant.availabilityLabel}
            </span>
          </div>
          <p className="text-xs text-muted">{merchant.zoneName}</p>
          {merchant.hoursLabel ? (
            <p className="text-xs text-muted">
              {merchant.hoursLabel}
              {merchant.hoursDetail ? ` · ${merchant.hoursDetail}` : ""}
            </p>
          ) : null}
          {logisticsBits.length > 0 ? (
            <p className="text-xs text-foreground/80">
              {logisticsBits.join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
