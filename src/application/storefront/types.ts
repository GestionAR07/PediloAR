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
};

export type PublicDiscoveryResult = {
  zones: PublicZoneOption[];
  selectedZone: PublicZoneOption | null;
  merchants: PublicMerchantCard[];
};

export type PublicPaymentMethodView = {
  label: string;
  instructions: string | null;
};

export type PublicOptionChoiceView = {
  id: string;
  name: string;
  priceDeltaLabel: string | null;
};

export type PublicOptionGroupView = {
  id: string;
  name: string;
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
  priceLabel: string;
  sellable: boolean;
  statusLabel: string | null;
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
