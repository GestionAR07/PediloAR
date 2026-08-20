import { useId } from "react";

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

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Qwen bag + lightning mark.
 * Revert this component to restore the letter-P tile without touching routes.
 */
export function PublicBrandMark({ size = "header", className }: Props) {
  const reactId = useId().replace(/:/g, "");
  const gradientId = `pedilo-mark-grad-${reactId}`;

  return (
    <svg
      viewBox="0 0 48 48"
      className={cx(
        "shrink-0 drop-shadow-[0_8px_16px_rgba(124,58,237,.45)]",
        sizeClass[size],
        className,
      )}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#D946EF" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="14"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M17.5 16.5v-2.5a6.5 6.5 0 0 1 13 0v2.5"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M13.5 16.5h21l-1.8 17.2a4.5 4.5 0 0 1-4.47 4.03H19.77a4.5 4.5 0 0 1-4.47-4.03z"
        fill="#fff"
      />
      <path d="M26.5 19.5l-7 9.5h4.5l-2.5 8 7-9.5H24z" fill="#FB923C" />
    </svg>
  );
}
