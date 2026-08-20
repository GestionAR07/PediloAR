export type MarketplaceCategoryIconKind =
  | "burger"
  | "pizza"
  | "fish"
  | "coffee"
  | "salad"
  | "empanadas"
  | "pharmacy"
  | "grocery"
  | "icecream"
  | "drinks"
  | "kiosk"
  | "bakery"
  | "food"
  | "store";

export type MarketplaceCategoryPalette =
  "violet" | "orange" | "cyan" | "green" | "amber" | "rose";

const PALETTES: readonly MarketplaceCategoryPalette[] = [
  "violet",
  "orange",
  "cyan",
  "green",
  "amber",
  "rose",
];

/** Small slug/name dictionary. Unknown categories use the store fallback. */
const ICON_BY_KEY: Readonly<Record<string, MarketplaceCategoryIconKind>> = {
  hamburguesas: "burger",
  hamburguesa: "burger",
  burger: "burger",
  sandwich: "burger",
  pizza: "pizza",
  pizzas: "pizza",
  pizzeria: "pizza",
  sushi: "fish",
  pescado: "fish",
  mariscos: "fish",
  cafe: "coffee",
  cafeteria: "coffee",
  coffee: "coffee",
  saludable: "salad",
  ensalada: "salad",
  ensaladas: "salad",
  empanadas: "empanadas",
  empanada: "empanadas",
  farmacia: "pharmacy",
  farmacias: "pharmacy",
  almacen: "grocery",
  super: "grocery",
  supermercado: "grocery",
  heladeria: "icecream",
  helado: "icecream",
  bebidas: "drinks",
  bebida: "drinks",
  kiosco: "kiosk",
  kioskos: "kiosk",
  panaderia: "bakery",
  pan: "bakery",
  gastronomia: "food",
  comida: "food",
  restaurante: "food",
  tiendas: "store",
  tienda: "store",
};

export function normalizeMarketplaceCategoryKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function marketplaceCategoryIconKind(input: {
  slug: string;
  name: string;
}): MarketplaceCategoryIconKind {
  const slugKey = normalizeMarketplaceCategoryKey(input.slug);
  const nameKey = normalizeMarketplaceCategoryKey(input.name);
  return ICON_BY_KEY[slugKey] ?? ICON_BY_KEY[nameKey] ?? "store";
}

export function hashMarketplaceCategoryId(categoryId: string): number {
  let hash = 0;
  for (const char of categoryId) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash);
}

export function marketplaceCategoryPalette(
  categoryId: string,
): MarketplaceCategoryPalette {
  return PALETTES[hashMarketplaceCategoryId(categoryId) % PALETTES.length]!;
}
