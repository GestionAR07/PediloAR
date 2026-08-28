import Image from "next/image";
import {
  PEDILO_BRAND_TILE_SRC,
  PEDILO_SYMBOL_SRC,
} from "@/lib/pedilo-brand-assets";

type MarkSize = "header" | "hero" | "compact";
type Surface = "light" | "dark";

type Props = {
  size?: MarkSize;
  surface?: Surface;
  className?: string;
};

const sizeClass: Record<MarkSize, string> = {
  header: "h-[2.7rem] w-[2.7rem] sm:h-12 sm:w-12",
  hero: "h-12 w-12",
  compact: "h-8 w-8",
};

const imageSizes: Record<MarkSize, string> = {
  header: "(min-width: 640px) 48px, 43px",
  hero: "48px",
  compact: "32px",
};

const markSrc: Record<Surface, string> = {
  light: PEDILO_SYMBOL_SRC,
  dark: PEDILO_SYMBOL_SRC,
};

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Official Pedilo isotipo extracted from pedilo-logo-master.svg.
 */
export function PublicBrandMark({
  size = "header",
  surface = "light",
  className,
}: Props) {
  return (
    <Image
      src={markSrc[surface]}
      alt=""
      width={160}
      height={160}
      sizes={imageSizes[size]}
      className={cx("shrink-0 object-contain", sizeClass[size], className)}
      aria-hidden
      priority={size === "header"}
      unoptimized
    />
  );
}

export { PEDILO_BRAND_TILE_SRC };
