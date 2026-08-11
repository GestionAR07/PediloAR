import type { MoneyCents } from "../money/money-cents";
import type {
  MarketplaceCategoryId,
  MerchantCategoryId,
  MerchantId,
  ProductId,
  ProductOptionChoiceId,
  ProductOptionGroupId,
} from "../shared/ids";
import type { OptionSelectionMode, StockMode } from "./enums";

/** Marketplace-wide taxonomy (Gastronomía, Panadería, …). */
export type MarketplaceCategory = {
  id: MarketplaceCategoryId;
  name: string;
  slug: string;
  sortOrder: number;
  active: boolean;
};

export type MerchantMarketplaceCategory = {
  merchantId: MerchantId;
  marketplaceCategoryId: MarketplaceCategoryId;
};

/** Internal menu sections of a single merchant (Pizzas, Empanadas, …). */
export type MerchantCategory = {
  id: MerchantCategoryId;
  merchantId: MerchantId;
  name: string;
  sortOrder: number;
  active: boolean;
};

export type Product = {
  id: ProductId;
  merchantId: MerchantId;
  merchantCategoryId: MerchantCategoryId;
  name: string;
  description: string;
  priceCents: MoneyCents;
  active: boolean;
  /** Quick kill-switch independent of stock. */
  available: boolean;
  stockMode: StockMode;
  /** Required when stockMode is TRACKED; ignored conceptually when NOT_TRACKED. */
  stockQuantity: number | null;
  sortOrder: number;
};

export type ProductOptionGroup = {
  id: ProductOptionGroupId;
  productId: ProductId;
  name: string;
  selectionMode: OptionSelectionMode;
  /** Minimum selections (SINGLE/MULTIPLE) or minimum total quantity (QUANTITY). */
  minSelections: number;
  /** Maximum selections (SINGLE/MULTIPLE) or maximum total quantity (QUANTITY). */
  maxSelections: number;
  sortOrder: number;
  active: boolean;
};

export type ProductOptionChoice = {
  id: ProductOptionChoiceId;
  groupId: ProductOptionGroupId;
  name: string;
  priceDeltaCents: MoneyCents;
  sortOrder: number;
  active: boolean;
};
