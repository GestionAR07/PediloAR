import type { MoneyCents } from "@/domain/money/money-cents";

/** Formats cents as ARS for merchant UI (e.g. 250050 → $2.500,50). */
export function formatMoneyCentsArs(cents: MoneyCents): string {
  const pesos = Math.floor(cents / 100);
  const fraction = cents % 100;
  const pesosFormatted = pesos.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `$${pesosFormatted},${fraction.toString().padStart(2, "0")}`;
}
