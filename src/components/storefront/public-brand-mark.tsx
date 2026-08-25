import Image from "next/image";

type MarkSize = "header" | "hero" | "compact";

type Props = {
  size?: MarkSize;
  className?: string;
};

const sizeClass: Record<MarkSize, string> = {
  header: "h-10 w-10 max-[359px]:h-9 max-[359px]:w-9",
  hero: "h-12 w-12",
  compact: "h-8 w-8",
};

const imageSizes: Record<MarkSize, string> = {
  header: "(max-width: 359px) 36px, 40px",
  hero: "48px",
  compact: "32px",
};

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Approved Pedilo raster mark.
 * Keep the high-resolution PNG as the single source for responsive web variants.
 */
export function PublicBrandMark({ size = "header", className }: Props) {
  return (
    <Image
      src="/brand/pedilo-mark.png"
      alt=""
      width={1254}
      height={1254}
      sizes={imageSizes[size]}
      className={cx(
        "shrink-0 object-contain drop-shadow-[0_8px_16px_rgba(46,16,73,.28)]",
        sizeClass[size],
        className,
      )}
      aria-hidden
      priority={size === "header"}
    />
  );
}
