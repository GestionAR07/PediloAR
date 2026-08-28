"use client";

import type { PublicMarketplaceCategory } from "@/application/storefront/types";
import {
  BasketIcon,
  BurgerIcon,
  ChefHatIcon,
  CoffeeIcon,
  CroissantIcon,
  FishIcon,
  IceCreamIcon,
  PackageIcon,
  PillIcon,
  PizzaIcon,
  SaladIcon,
  SodaIcon,
  StoreIcon,
  UtensilsIcon,
} from "@/components/ui/public-icons";
import {
  marketplaceCategoryIconKind,
  marketplaceCategoryPalette,
  type MarketplaceCategoryIconKind,
} from "@/lib/public-marketplace-category-visual";

type Props = {
  categories: PublicMarketplaceCategory[];
  selectedCategoryId: string | null;
  onSelect: (categoryId: string | null) => void;
};

function CategoryGlyph({
  kind,
  className,
}: {
  kind: MarketplaceCategoryIconKind;
  className?: string;
}) {
  switch (kind) {
    case "burger":
      return <BurgerIcon className={className} />;
    case "pizza":
      return <PizzaIcon className={className} />;
    case "fish":
      return <FishIcon className={className} />;
    case "coffee":
      return <CoffeeIcon className={className} />;
    case "salad":
      return <SaladIcon className={className} />;
    case "empanadas":
      return <ChefHatIcon className={className} />;
    case "pharmacy":
      return <PillIcon className={className} />;
    case "grocery":
      return <BasketIcon className={className} />;
    case "icecream":
      return <IceCreamIcon className={className} />;
    case "drinks":
      return <SodaIcon className={className} />;
    case "kiosk":
      return <PackageIcon className={className} />;
    case "bakery":
      return <CroissantIcon className={className} />;
    case "food":
      return <UtensilsIcon className={className} />;
    default:
      return <StoreIcon className={className} />;
  }
}

export function PublicCategoryRail({
  categories,
  selectedCategoryId,
  onSelect,
}: Props) {
  if (categories.length === 0) {
    return null;
  }

  const allSelected = selectedCategoryId === null;

  return (
    <section id="categorias" className="min-w-0 max-w-full space-y-5">
      <div className="min-w-0">
        <p className="mb-2 text-xs font-extrabold tracking-[0.2em] break-words text-[var(--ps-sky)]">
          EXPLORÁ
        </p>
        <h2 className="font-display text-2xl font-extrabold tracking-tight break-words text-[var(--ps-deep)] lg:text-4xl">
          ¿Qué necesitás hoy?
        </h2>
      </div>

      <div className="category-rail-wrap min-w-0 max-w-full">
        <div
          className="category-rail no-scrollbar flex gap-4 overflow-x-auto snap-x snap-mandatory lg:flex-wrap lg:overflow-visible"
          role="group"
          aria-label="Categorías del marketplace"
        >
          <button
            type="button"
            aria-pressed={allSelected}
            onClick={() => onSelect(null)}
            className="category-tile snap-start shrink-0 w-[5.5rem] sm:w-[6.5rem] lg:w-[7rem]"
          >
            <span
              className={`category-tile-swatch category-tile-swatch--all flex h-[5.5rem] w-full items-center justify-center rounded-[1.4rem] sm:h-[6.5rem] ${allSelected ? "category-tile-swatch--active" : ""}`}
            >
              <StoreIcon className="h-9 w-9 text-white sm:h-10 sm:w-10" />
            </span>
            <span className="mt-2.5 block text-center text-xs font-extrabold break-words text-[var(--ps-night-900)] sm:text-sm">
              Todos
            </span>
          </button>

          {categories.map((category) => {
            const selected = selectedCategoryId === category.id;
            const palette = marketplaceCategoryPalette(category.id);
            const kind = marketplaceCategoryIconKind({
              slug: category.slug,
              name: category.name,
            });
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(selected ? null : category.id)}
                className="category-tile snap-start shrink-0 w-[5.5rem] sm:w-[6.5rem] lg:w-[7rem]"
              >
                <span
                  className={`category-tile-swatch category-tile-swatch--${palette} flex h-[5.5rem] w-full items-center justify-center rounded-[1.4rem] sm:h-[6.5rem] ${selected ? "category-tile-swatch--active" : ""}`}
                >
                  <CategoryGlyph
                    kind={kind}
                    className="h-9 w-9 text-white sm:h-10 sm:w-10"
                  />
                </span>
                <span className="mt-2.5 block text-center text-xs font-extrabold break-words text-[var(--ps-night-900)] sm:text-sm">
                  {category.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
