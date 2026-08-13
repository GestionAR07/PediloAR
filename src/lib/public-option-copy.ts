import { getOptionModePresentation } from "@/lib/option-mode-presentation";

/** Buyer-facing summary for QUANTITY groups (e.g. fixed dozen). */
export function getPublicQuantitySelectionSummary(
  minSelections: number,
  maxSelections: number,
): string {
  if (minSelections === maxSelections) {
    return `Elegí ${minSelections} unidades entre estas variedades.`;
  }
  return `Elegí entre ${minSelections} y ${maxSelections} unidades.`;
}

export function getPublicOptionGroupModeLabel(selectionMode: string): string {
  if (selectionMode === "SINGLE") {
    return "Elegí una opción";
  }
  if (selectionMode === "MULTIPLE") {
    return "Elegí varias";
  }
  if (selectionMode === "QUANTITY") {
    return "Variedades";
  }
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

  if (input.selectionMode === "SINGLE") {
    if (input.minSelections === 0) {
      return "Opcional.";
    }
    return "Selección obligatoria.";
  }

  if (input.selectionMode === "MULTIPLE") {
    const parts: string[] = [];
    if (input.minSelections > 0) {
      parts.push(`Elegí al menos ${input.minSelections}.`);
    }
    if (input.maxSelections > 0) {
      parts.push(`Podés elegir hasta ${input.maxSelections}.`);
    }
    return parts.length > 0
      ? parts.join(" ")
      : getOptionModePresentation(input.selectionMode).description;
  }

  return getOptionModePresentation(input.selectionMode).description;
}
