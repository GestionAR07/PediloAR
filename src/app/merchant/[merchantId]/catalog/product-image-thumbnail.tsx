type Props = {
  name: string;
  imageUrl?: string | null;
  size?: "sm" | "md";
};

export function ProductImageThumbnail({ name, imageUrl, size = "sm" }: Props) {
  const dimension = size === "md" ? "h-16 w-16" : "h-12 w-12";

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        className={`${dimension} shrink-0 rounded-md border border-border object-cover`}
      />
    );
  }

  return (
    <div
      aria-hidden
      title={`Sin imagen · ${name}`}
      className={`${dimension} flex shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-white/70 text-[10px] text-muted`}
    >
      Sin img
    </div>
  );
}
