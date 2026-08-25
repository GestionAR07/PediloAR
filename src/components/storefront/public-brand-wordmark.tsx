import { PublicBrandMark } from "@/components/storefront/public-brand-mark";
import { APP_NAME } from "@/lib/app-info";

type Size = "header" | "hero" | "compact";
type Tone = "plain" | "gradient";
type Surface = "light" | "dark";

type Props = {
  size?: Size;
  tone?: Tone;
  surface?: Surface;
  showMark?: boolean;
  className?: string;
};

function splitWordmark(name: string): { stem: string; accent: string } {
  if (name.length < 3) {
    return { stem: name, accent: "" };
  }
  return {
    stem: name.slice(0, -2),
    accent: name.slice(-2),
  };
}

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const sizeClass: Record<Size, string> = {
  header: "text-[clamp(1.25rem,0.7rem+2.4vw,1.5rem)]",
  hero: "text-[2.85rem] sm:text-6xl lg:text-7xl",
  compact: "text-lg",
};

export function PublicBrandWordmark({
  size = "header",
  tone = "plain",
  surface,
  showMark,
  className,
}: Props) {
  const { stem, accent } = splitWordmark(APP_NAME);
  const resolvedSurface = surface ?? (size === "hero" ? "dark" : "light");
  const resolvedShowMark = showMark ?? size === "header";

  return (
    <span
      className={cx(
        "brand-wordmark inline-flex items-center gap-2.5",
        tone === "gradient"
          ? "brand-wordmark--gradient"
          : "brand-wordmark--plain",
        resolvedSurface === "dark"
          ? "brand-wordmark--dark"
          : "brand-wordmark--light",
        size === "hero" && "brand-wordmark--hero",
        className,
      )}
    >
      {resolvedShowMark ? (
        <PublicBrandMark size={size} surface={resolvedSurface} />
      ) : null}
      <span
        className={cx(
          "brand-wordmark-text font-display font-extrabold",
          sizeClass[size],
        )}
      >
        <span className="brand-wordmark-stem">{stem}</span>
        {accent ? (
          <span className="brand-wordmark-accent">{accent}</span>
        ) : null}
      </span>
    </span>
  );
}
