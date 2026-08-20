/**
 * Public storefront DTOs — only buyer-safe commercial fields.
 * Never include user ids, emails, memberships, secrets, or audit internals.
 */

export type PublicZoneOption = {
  id: string;
  name: string;
  cityName: string;
};

export type PublicLogisticsPresentation = {
  pickupAvailable: boolean;
  deliveryAvailable: boolean;
  deliveryFeeLabel: string | null;
  minimumOrderLabel: string | null;
  estimatedMinutesLabel: string | null;
  preparationMinutesLabel: string | null;
};

export type PublicMarketplaceCategory = {
  id: string;
  name: string;
  slug: string;
};

export type PublicMerchantCard = {
  id: string;
  name: string;
  zoneName: string;
  description: string;
  availabilityLabel: string;
  availabilityTone: "available" | "paused" | "unavailable";
  hoursLabel: string | null;
  hoursDetail: string | null;
  logistics: PublicLogisticsPresentation;
  href: string;
  /** Active marketplace category ids for client-side discovery filters. */
  categoryIds: string[];
  /** Temporary signed cover URL. Never a storage path. */
  coverUrl: string | null;
};

export type PublicDiscoveryResult = {
  zones: PublicZoneOption[];
  selectedZone: PublicZoneOption | null;
  merchants: PublicMerchantCard[];
  categories: PublicMarketplaceCategory[];
};

export type PublicPaymentMethodView = {
  code: string;
  label: string;
  instructions: string | null;
};

export type PublicOptionChoiceView = {
  id: string;
  name: string;
  /** Integer cents delta for configurator pricing (buyer-safe). */
  priceDeltaCents: number;
  priceDeltaLabel: string | null;
};

export type PublicOptionGroupView = {
  id: string;
  name: string;
  /** Domain mode for interactive selection — not shown as jargon in UI. */
  selectionMode: "SINGLE" | "MULTIPLE" | "QUANTITY" | string;
  minSelections: number;
  maxSelections: number;
  modeLabel: string;
  hint: string;
  choices: PublicOptionChoiceView[];
};

export type PublicProductCard = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  /** Integer cents base price for local cart estimates. */
  priceCents: number;
  priceLabel: string;
  sellable: boolean;
  /** True when product is sellable and merchant is accepting orders. */
  canAddToCart: boolean;
  statusLabel: string | null;
  stockMode: string;
  stockQuantity: number | null;
  imageUrl: string | null;
  hasOptions: boolean;
  optionGroups: PublicOptionGroupView[];
};

export type PublicCategoryView = {
  id: string;
  name: string;
};

export type PublicMerchantPage = {
  id: string;
  name: string;
  description: string;
  zoneName: string;
  cityName: string;
  availabilityLabel: string;
  availabilityTone: "available" | "paused" | "unavailable";
  hoursLabel: string | null;
  hoursDetail: string | null;
  logistics: PublicLogisticsPresentation;
  paymentMethods: PublicPaymentMethodView[];
  categories: PublicCategoryView[];
  products: PublicProductCard[];
};

/** Soft nav context — never throws for guests. */
export type PublicNavContext = {
  isAuthenticated: boolean;
  isAdmin: boolean;
  merchantHomeHref: string | null;
};
