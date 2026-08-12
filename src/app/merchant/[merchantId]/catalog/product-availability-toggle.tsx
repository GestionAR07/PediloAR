"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { CatalogActionState } from "./action-state";

type Props = {
  merchantId: string;
  productId: string;
  available: boolean;
  action: (
    merchantId: string,
    productId: string,
  ) => Promise<CatalogActionState>;
};

export function ProductAvailabilityToggle({
  merchantId,
  productId,
  available,
  action,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await action(merchantId, productId);
          router.refresh();
        });
      }}
      className={`min-h-10 rounded-md px-3 py-2 text-sm ${
        available
          ? "border border-amber-700/30 bg-amber-50 text-amber-900"
          : "border border-accent/30 bg-accent/10 text-accent"
      }`}
    >
      {pending ? "..." : available ? "Marcar sin stock" : "Marcar disponible"}
    </button>
  );
}
