import type { OptionSelectionMode } from "@/domain/catalog/enums";
import { OPTION_SELECTION_MODES } from "@/domain/catalog/enums";

export type OptionModePresentation = {
  internalMode: OptionSelectionMode;
  label: string;
  description: string;
  examples: string;
  optionNamePlaceholder: string;
};

export const OPTION_MODE_PRESENTATIONS: OptionModePresentation[] = [
  {
    internalMode: "SINGLE",
    label: "Elegir una opción",
    description: "El cliente elige una sola alternativa.",
    examples: "Tamaño, presentación, tipo de masa, sabor principal.",
    optionNamePlaceholder: "475 cc, 1,5 L, Grande, Familiar",
  },
  {
    internalMode: "MULTIPLE",
    label: "Elegir varias",
    description: "El cliente puede agregar varias opciones.",
    examples: "Extras, ingredientes, agregados.",
    optionNamePlaceholder: "Cheddar, Panceta, Huevo",
  },
  {
    internalMode: "QUANTITY",
    label: "Variedades por unidad",
    description: "El cliente indica cuántas unidades quiere de cada variedad.",
    examples: "Docena de empanadas, sabores por unidad, combos mixtos.",
    optionNamePlaceholder: "Carne, Jamón y queso, Verdura",
  },
];

export function getOptionModePresentation(
  mode: string,
): OptionModePresentation {
  const found = OPTION_MODE_PRESENTATIONS.find((p) => p.internalMode === mode);
  if (found) {
    return found;
  }
  return OPTION_MODE_PRESENTATIONS[0]!;
}

/** Defaults applied only when creating a new group without explicit bounds. */
export function defaultBoundsForNewOptionGroup(mode: OptionSelectionMode): {
  minSelections: number;
  maxSelections: number;
} {
  switch (mode) {
    case "SINGLE":
      return { minSelections: 1, maxSelections: 1 };
    case "MULTIPLE":
      return { minSelections: 0, maxSelections: 10 };
    case "QUANTITY":
      return { minSelections: 1, maxSelections: 24 };
  }
}

export function getAdvancedBoundsHint(mode: string): string {
  switch (mode) {
    case "SINGLE":
      return "Por defecto el cliente elige exactamente una opción. Podés usar 0 / 1 si la elección es opcional.";
    case "MULTIPLE":
      return "Mínimo y máximo de extras o agregados que el cliente puede elegir.";
    case "QUANTITY":
      return "Mínimo y máximo de unidades totales entre todas las variedades (ej.: 12 en una docena).";
    default:
      return "Límites de selección para este grupo.";
  }
}

export function isKnownOptionSelectionMode(
  mode: string,
): mode is OptionSelectionMode {
  return OPTION_SELECTION_MODES.includes(mode as OptionSelectionMode);
}
