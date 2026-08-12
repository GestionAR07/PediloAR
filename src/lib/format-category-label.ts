/** Admin label for merchant category selectors and filters. */
export function formatMerchantCategoryLabel(
  name: string,
  active: boolean,
): string {
  return active ? name : `${name} (inactiva)`;
}
