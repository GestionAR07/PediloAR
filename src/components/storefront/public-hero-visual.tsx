import Image from "next/image";
import type { ReactNode } from "react";
import {
  BikeIcon,
  ShoppingBagIcon,
  StoreIcon,
} from "@/components/ui/public-icons";

export const PUBLIC_HERO_MEDIA_SRC = "/brand/pedilo-hero-media.svg";
export const PUBLIC_BRAND_MARK_SRC = "/brand/pedilo-mark.svg";

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
      className={`glass public-hero-card public-hero-card--${variant} card-lift rounded-2xl px-3.5 py-3 shadow-xl sm:px-4`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${tone}`}
        >
          {icon}
        </span>
        <div>
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
    <div className="public-hero-visual relative mx-auto h-[330px] w-[300px] sm:h-[430px] sm:w-[400px] lg:h-[520px] lg:w-[480px]">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-500/25 blur-[70px] sm:h-[330px] sm:w-[330px] lg:h-[400px] lg:w-[400px]"
      />

      <div
        data-hero-media-slot
        className="public-hero-media-slot absolute top-1/2 left-1/2 h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full ring-8 ring-white/10 shadow-[0_0_120px_rgba(217,70,239,.4)] sm:h-[330px] sm:w-[330px] lg:h-[400px] lg:w-[400px]"
      >
        {/* Local brand illustration until an approved photograph exists. */}
        <Image
          src={mediaSrc}
          alt={mediaAlt}
          fill
          sizes="(min-width: 1024px) 400px, (min-width: 640px) 330px, 240px"
          className="object-cover"
          unoptimized
          priority
        />
      </div>

      <div className="absolute bottom-6 -left-2 h-20 w-20 -rotate-6 overflow-hidden rounded-[1.4rem] ring-4 ring-white/20 shadow-2xl sm:h-28 sm:w-28">
        <Image
          src={PUBLIC_BRAND_MARK_SRC}
          alt=""
          fill
          sizes="112px"
          className="object-cover"
          unoptimized
        />
      </div>

      <div className="absolute top-2 -right-2 sm:right-0">
        <HeroCard
          variant="a"
          tone="bg-gradient-to-br from-violet-500 to-fuchsia-500"
          icon={<StoreIcon className="h-5 w-5" />}
          title="Comercios"
          detail="de tu zona"
        />
      </div>
      <div className="absolute top-1/3 right-0 sm:-right-2">
        <HeroCard
          variant="b"
          tone="bg-gradient-to-br from-orange-400 to-rose-500"
          icon={<BikeIcon className="h-5 w-5" />}
          title="Retiro o entrega"
          detail="según el comercio"
        />
      </div>
      <div className="absolute bottom-0 left-0 sm:left-4">
        <HeroCard
          variant="c"
          tone="bg-gradient-to-br from-lime-400 to-emerald-500"
          icon={<ShoppingBagIcon className="h-5 w-5" />}
          title="Pedido simple"
          detail="sin vueltas"
        />
      </div>

      <span
        aria-hidden
        className="absolute top-4 left-8 h-3 w-3 rounded-full bg-fuchsia-400"
      />
      <span
        aria-hidden
        className="absolute right-12 bottom-16 h-2 w-2 rounded-full bg-orange-400"
      />
    </div>
  );
}
