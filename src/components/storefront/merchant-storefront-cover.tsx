"use client";

import { useState } from "react";
import { MerchantCoverFallback } from "@/components/storefront/merchant-cover-fallback";

type Props = {
  name: string;
  coverUrl: string | null;
  priority?: boolean;
};

/**
 * Wide storefront cover. Uses the signed coverUrl from the server DTO,
 * or the shared Pedilo fallback. Never renders a storage path.
 */
export function MerchantStorefrontCover({
  name,
  coverUrl,
  priority = false,
}: Props) {
  const [failed, setFailed] = useState(false);

  if (!coverUrl || failed) {
    return <MerchantCoverFallback name={name} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={coverUrl}
      alt={`Portada de ${name}`}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      className="merchant-storefront-cover-img h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}
