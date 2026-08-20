import type { PublicMerchantCard } from "@/application/storefront/types";

/**
 * Client-side discovery filter over merchants already loaded for the zone.
 * Order: category (if any) → name/description search.
 * Never looks at products or invented category strings.
 */
export function filterPublicMerchants(
  merchants: PublicMerchantCard[],
  query: string,
  selectedCategoryId: string | null = null,
): PublicMerchantCard[] {
  const categoryId = selectedCategoryId?.trim() || null;
  const needle = query.trim().toLowerCase();

  if (!categoryId && !needle) {
    return merchants;
  }

  return merchants.filter((merchant) => {
    if (categoryId && !merchant.categoryIds.includes(categoryId)) {
      return false;
    }
    if (!needle) {
      return true;
    }
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
