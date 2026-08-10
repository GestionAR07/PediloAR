type StatusBadgeProps = {
  label: string;
};

export function StatusBadge({ label }: StatusBadgeProps) {
  return (
    <p className="mt-3 text-sm font-medium tracking-wide text-accent sm:text-base">
      {label}
    </p>
  );
}
