import Image from "next/image";
import type { ReactNode } from "react";
import {
  PEDILO_BRAND_TILE_SRC,
  PEDILO_HERO_GROCERY_BAG_SRC,
} from "@/lib/pedilo-brand-assets";
import {
  BikeIcon,
  ShoppingBagIcon,
  StoreIcon,
} from "@/components/ui/public-icons";

export const PUBLIC_HERO_MEDIA_SRC = PEDILO_HERO_GROCERY_BAG_SRC;
export const PUBLIC_BRAND_MARK_SRC = PEDILO_BRAND_TILE_SRC;

type Props = {
  mediaSrc?: string;
  mediaAlt?: string;
};

function HeroCard({
  tone,
  icon,
  title,
  detail,
  variant,
}: {
  tone: string;
  icon: ReactNode;
  title: string;
  detail: string;
  variant: "a" | "b" | "c";
}) {
  return (
    <div
      className={`glass public-hero-card public-hero-card--${variant} card-lift rounded-2xl px-3 py-2.5 shadow-xl sm:px-4 sm:py-3`}
    >
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white sm:h-9 sm:w-9 ${tone}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-[var(--ps-deep)]">{title}</p>
          <p className="text-[11px] font-medium text-[var(--color-muted)]">
            {detail}
          </p>
        </div>
      </div>
    </div>
  );
}

export function PublicHeroVisual({
  mediaSrc = PUBLIC_HERO_MEDIA_SRC,
  mediaAlt = "Bolsa Pedilo con productos de compra",
}: Props) {
  return (
    <div className="public-hero-visual">
      <div className="public-hero-visual-atmosphere" aria-hidden />

      <div className="public-hero-media-layer">
        <div data-hero-media-slot className="public-hero-media-slot">
          {/* Official grocery-bag hero illustration (transparent PNG/WebP). */}
          <Image
            src={mediaSrc}
            alt={mediaAlt}
            fill
            sizes="(min-width: 1024px) 420px, (min-width: 640px) 340px, 75vw"
            className="object-contain"
            priority
          />
        </div>
      </div>

      <div className="public-hero-sat">
        <Image
          src={PUBLIC_BRAND_MARK_SRC}
          alt=""
          fill
          sizes="112px"
          className="object-cover"
        />
      </div>

      <div className="public-hero-card-slot public-hero-card-slot--a">
        <HeroCard
          variant="a"
          tone="bg-gradient-to-br from-[var(--ps-blue)] to-[var(--ps-sky)]"
          icon={<StoreIcon className="h-5 w-5" />}
          title="Comercios cerca"
          detail="de tu zona"
        />
      </div>
      <div className="public-hero-card-slot public-hero-card-slot--b">
        <HeroCard
          variant="b"
          tone="bg-gradient-to-br from-[var(--ps-yellow)] to-[var(--ps-yellow-hover)] text-[var(--ps-deep)]"
          icon={<ShoppingBagIcon className="h-5 w-5" />}
          title="Encontrá lo que buscás"
          detail="productos para tu día"
        />
      </div>
      <div className="public-hero-card-slot public-hero-card-slot--c">
        <HeroCard
          variant="c"
          tone="bg-gradient-to-br from-[var(--ps-sky)] to-[var(--ps-sky-medium)]"
          icon={<BikeIcon className="h-5 w-5" />}
          title="Retiro o entrega"
          detail="según el comercio"
        />
      </div>

      <span className="public-hero-dot public-hero-dot--a" aria-hidden />
      <span className="public-hero-dot public-hero-dot--b" aria-hidden />
    </div>
  );
}
