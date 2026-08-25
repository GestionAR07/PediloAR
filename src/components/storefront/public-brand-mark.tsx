import Image from "next/image";

type MarkSize = "header" | "hero" | "compact";
type Surface = "light" | "dark";

type Props = {
  size?: MarkSize;
  surface?: Surface;
  className?: string;
};

const sizeClass: Record<MarkSize, string> = {
  header: "h-10 w-10 sm:h-11 sm:w-11",
  hero: "h-12 w-12",
  compact: "h-8 w-8",
};

const imageSizes: Record<MarkSize, string> = {
  header: "(min-width: 640px) 44px, 40px",
  hero: "48px",
  compact: "32px",
};

const markSrc: Record<Surface, string> = {
  light: "/brand/pedilo-brand-tile.svg",
  dark: "/brand/pedilo-symbol.svg",
};

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Surface-aware Pedilo mark: framed on light surfaces and transparent on dark.
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
