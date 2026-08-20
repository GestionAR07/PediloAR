import type { PublicMerchantCard } from "@/application/storefront/types";

/**
 * Client-side discovery search over merchants already loaded for the zone.
 * Matches name and description only — never products or invented categories.
 */
export function filterPublicMerchants(
  merchants: PublicMerchantCard[],
  query: string,
): PublicMerchantCard[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return merchants;
  }

  return merchants.filter((merchant) => {
    const name = merchant.name.toLowerCase();
    const description = merchant.description.toLowerCase();
    return name.includes(needle) || description.includes(needle);
  });
}

export function merchantCardHref(
  href: string,
  zoneId: string | null | undefined,
): string {
  if (!zoneId) {
    return href;
  }
  const [path, existingQuery] = href.split("?");
  const params = new URLSearchParams(existingQuery);
  params.set("zone", zoneId);
  return `${path}?${params.toString()}`;
}
