"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function CustomerOrderAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 20_000);
    return () => window.clearInterval(interval);
  }, [active, router]);

  return active ? (
    <p className="text-xs text-muted" role="status">
      El estado se actualiza automáticamente.
    </p>
  ) : null;
}
