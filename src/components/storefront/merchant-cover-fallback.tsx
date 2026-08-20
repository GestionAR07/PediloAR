type Props = {
  name: string;
};

const GRADIENTS = [
  "from-violet-800 via-violet-600 to-fuchsia-500",
  "from-[var(--ps-night-800)] via-violet-700 to-fuchsia-600",
  "from-violet-700 via-fuchsia-600 to-orange-400",
] as const;

/**
 * Honest editorial cover when the merchant has no cover photo.
 * Variant is deterministic from the name — not a remote or invented photo.
 */
export function MerchantCoverFallback({ name }: Props) {
  const trimmed = name.trim();
  const initial = trimmed.slice(0, 1).toUpperCase() || "P";
  const variant = trimmed.length % GRADIENTS.length;

  return (
    <div className="zoom-img absolute inset-0 isolate overflow-hidden">
      <div
        aria-hidden
        className={`absolute inset-0 bg-gradient-to-br ${GRADIENTS[variant]}`}
      />
      <span
        aria-hidden
        className="absolute top-3 right-4 h-24 w-24 rounded-full bg-white/10 blur-xl"
      />
      <span
        aria-hidden
        className="absolute bottom-4 left-4 h-20 w-20 rounded-[2rem] bg-fuchsia-400/20 blur-lg"
      />
      <span
        aria-hidden
        className="absolute right-8 bottom-6 h-16 w-16 rotate-12 rounded-2xl border border-white/15"
      />
      <span className="font-display absolute inset-0 flex items-center justify-center text-5xl font-extrabold tracking-tight text-white/90 sm:text-6xl">
        {initial}
      </span>
    </div>
  );
}
