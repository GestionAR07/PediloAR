import Image from "next/image";
import { APP_NAME } from "@/lib/app-info";
import {
  PEDILO_LOGO_REVERSED_SRC,
  PEDILO_LOGO_SRC,
  PEDILO_LOGOTYPE_REVERSED_SRC,
  PEDILO_LOGOTYPE_SRC,
} from "@/lib/pedilo-brand-assets";
import { PublicBrandMark } from "@/components/storefront/public-brand-mark";

type Size = "header" | "hero" | "compact";
type MarkSize = "header" | "hero" | "compact";
type Layout = "lockup" | "full" | "logotype";
type Tone = "plain" | "gradient";
type Surface = "light" | "dark";

type Props = {
  size?: Size;
  layout?: Layout;
  tone?: Tone;
  surface?: Surface;
  showMark?: boolean;
  className?: string;
};

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const lockupMarkSize: Record<Size, MarkSize> = {
  header: "header",
  hero: "hero",
  compact: "compact",
};

const logotypeHeight: Record<Size, string> = {
  header: "h-[1.45rem] w-auto sm:h-[1.625rem]",
  hero: "h-8 w-auto sm:h-9",
  compact: "h-6 w-auto",
};

const fullLogoHeight: Record<Size, string> = {
  header: "h-10 w-auto",
  hero: "h-24 w-auto sm:h-28",
  compact: "h-16 w-auto",
};

function resolveLayout(
  layout: Layout | undefined,
  size: Size,
  showMark: boolean,
): Layout {
  if (layout) {
    return layout;
  }
  if (size === "hero") {
    return "full";
  }
  return showMark ? "lockup" : "logotype";
}

/**
 * Official Pedilo logo from pedilo-logo-master.svg derivatives.
 * Never reconstructs the wordmark with CSS typography.
 */
export function PublicBrandWordmark({
  size = "header",
  layout,
  surface,
  showMark = true,
  className,
}: Props) {
  const resolvedSurface = surface ?? (size === "hero" ? "dark" : "light");
  const resolvedLayout = resolveLayout(layout, size, showMark);
  const reversed = resolvedSurface === "dark";

  if (resolvedLayout === "full") {
    return (
      <span
        className={cx("brand-wordmark inline-flex items-center", className)}
      >
        <Image
          src={reversed ? PEDILO_LOGO_REVERSED_SRC : PEDILO_LOGO_SRC}
          alt={APP_NAME}
          width={150}
          height={150}
          sizes={size === "hero" ? "224px" : "160px"}
          className={cx("shrink-0 object-contain", fullLogoHeight[size])}
          priority={size === "header"}
          unoptimized
        />
      </span>
    );
  }

  if (resolvedLayout === "logotype") {
    return (
      <span
        className={cx("brand-wordmark inline-flex items-center", className)}
      >
        <Image
          src={reversed ? PEDILO_LOGOTYPE_REVERSED_SRC : PEDILO_LOGOTYPE_SRC}
          alt={APP_NAME}
          width={128}
          height={35}
          sizes={size === "header" ? "120px" : "96px"}
          className={cx("shrink-0 object-contain", logotypeHeight[size])}
          priority={size === "header"}
          unoptimized
        />
      </span>
    );
  }

  return (
    <span
      className={cx(
        "brand-wordmark brand-wordmark--lockup inline-flex items-center gap-2.5",
        className,
      )}
    >
      <PublicBrandMark size={lockupMarkSize[size]} surface={resolvedSurface} />
      <Image
        src={reversed ? PEDILO_LOGOTYPE_REVERSED_SRC : PEDILO_LOGOTYPE_SRC}
        alt={APP_NAME}
        width={128}
        height={35}
        sizes={size === "header" ? "120px" : "96px"}
        className={cx("min-w-0 shrink object-contain", logotypeHeight[size])}
        priority={size === "header"}
        unoptimized
      />
    </span>
  );
}
