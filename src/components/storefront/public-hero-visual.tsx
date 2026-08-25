import Image from "next/image";
import type { ReactNode } from "react";
import {
  BikeIcon,
  ShoppingBagIcon,
  StoreIcon,
} from "@/components/ui/public-icons";

export const PUBLIC_HERO_MEDIA_SRC = "/brand/pedilo-symbol.svg";
export const PUBLIC_BRAND_MARK_SRC = "/brand/pedilo-mark.png";

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
          <p className="text-xs font-bold text-white">{title}</p>
          <p className="text-[11px] font-medium text-slate-300">{detail}</p>
        </div>
      </div>
    </div>
  );
}

export function PublicHeroVisual({
  mediaSrc = PUBLIC_HERO_MEDIA_SRC,
  mediaAlt = "",
}: Props) {
  return (
    <div className="public-hero-visual">
      <div className="public-hero-visual-atmosphere" aria-hidden />

      <div data-hero-media-slot className="public-hero-media-slot">
        {/* Simplified vector symbol keeps the hero sharp at every viewport. */}
        <Image
          src={mediaSrc}
          alt={mediaAlt}
          fill
          sizes="(min-width: 1024px) 400px, (min-width: 640px) 330px, 72vw"
          className="object-contain"
          priority
          unoptimized
        />
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
          tone="bg-gradient-to-br from-violet-500 to-fuchsia-500"
          icon={<StoreIcon className="h-5 w-5" />}
          title="Comercios"
          detail="de tu zona"
        />
      </div>
      <div className="public-hero-card-slot public-hero-card-slot--b">
        <HeroCard
          variant="b"
          tone="bg-gradient-to-br from-orange-400 to-rose-500"
          icon={<BikeIcon className="h-5 w-5" />}
          title="Retiro o entrega"
          detail="según el comercio"
        />
      </div>
      <div className="public-hero-card-slot public-hero-card-slot--c">
        <HeroCard
          variant="c"
          tone="bg-gradient-to-br from-lime-400 to-emerald-500"
          icon={<ShoppingBagIcon className="h-5 w-5" />}
          title="Pedido simple"
          detail="sin vueltas"
        />
      </div>

      <span className="public-hero-dot public-hero-dot--a" aria-hidden />
      <span className="public-hero-dot public-hero-dot--b" aria-hidden />
    </div>
  );
}
