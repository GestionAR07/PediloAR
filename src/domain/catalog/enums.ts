export const STOCK_MODES = ["NOT_TRACKED", "TRACKED"] as const;
export type StockMode = (typeof STOCK_MODES)[number];

export const OPTION_SELECTION_MODES = [
  "SINGLE",
  "MULTIPLE",
  "QUANTITY",
] as const;
export type OptionSelectionMode = (typeof OPTION_SELECTION_MODES)[number];
