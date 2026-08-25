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
 * Original Pedilo symbol, extracted from the approved artwork with transparency.
 */
export function PublicBrandMark({ size = "header", className }: Props) {
  return (
    <Image
      src="/brand/pedilo-symbol-original.png"
      alt=""
      width={443}
      height={433}
      sizes={imageSizes[size]}
      className={cx("shrink-0 object-contain", sizeClass[size], className)}
      aria-hidden
      priority={size === "header"}
    />
  );
}
