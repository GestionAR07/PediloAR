import { getOptionModePresentation } from "@/lib/option-mode-presentation";

/** Buyer-facing summary for QUANTITY groups (e.g. fixed dozen). */
export function getPublicQuantitySelectionSummary(
  minSelections: number,
  maxSelections: number,
): string {
  if (minSelections === maxSelections) {
    return `Elegí ${minSelections} unidades entre estas variedades.`;
  }
  return `Elegí entre ${minSelections} y ${maxSelections} unidades entre estas variedades.`;
}

export function getPublicOptionGroupModeLabel(selectionMode: string): string {
  return getOptionModePresentation(selectionMode).label;
}

export function getPublicOptionGroupHint(input: {
  selectionMode: string;
  minSelections: number;
  maxSelections: number;
}): string {
  if (input.selectionMode === "QUANTITY") {
    return getPublicQuantitySelectionSummary(
      input.minSelections,
      input.maxSelections,
    );
  }
  return getOptionModePresentation(input.selectionMode).description;
}
