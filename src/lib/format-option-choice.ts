/** One-line summary for merchant option lists (e.g. "475cc — +$1.500,00"). */
export function formatOptionChoiceLine(
  name: string,
  priceDeltaCents: number,
  formatMoney: (cents: number) => string,
): string {
  if (priceDeltaCents <= 0) {
    return `${name} — ${formatMoney(priceDeltaCents)}`;
  }
  return `${name} — +${formatMoney(priceDeltaCents).replace(/^\$/, "")}`;
}
