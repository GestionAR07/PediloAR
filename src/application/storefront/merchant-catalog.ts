import {
  getMerchantOperationalStatus,
  type MerchantOperationalFields,
} from "@/domain/merchant/operational-availability";
import type { MerchantStatus } from "@/domain/merchant/enums";
import type { MerchantOpeningInterval } from "@/domain/merchant/types";
import { moneyCents } from "@/domain/money/money-cents";
import { formatMoneyCentsArs } from "@/lib/format-money";
import {
  getMerchantHoursOpenState,
  getPublicHoursPresentation,
} from "@/lib/public-hours";
import { getPublicMerchantAvailabilityPresentation } from "@/lib/public-merchant-availability";
import {
  getPublicOptionGroupHint,
  getPublicOptionGroupModeLabel,
} from "@/lib/public-option-copy";
import { getPublicProductPurchasePresentation } from "@/lib/public-product-purchase";
import { isValidUuid } from "@/lib/uuid";
import { buildPublicLogisticsPresentation } from "./logistics";
import type {
  PublicMerchantPage,
  PublicOptionGroupView,
  PublicProductCard,
} from "./types";

export type CatalogMerchantRecord = {
  id: string;
  name: string;
  description: string;
  status: string;
  zoneId: string;
  zoneName: string;
  cityName: string;
  cityTimezone: string;
  pickupEnabled: boolean;
  merchantDeliveryEnabled: boolean;
  preparationMinutes: number;
  acceptingOrders: boolean;
  pausedUntil: Date | null;
  coverImagePath: string | null;
};

export type CatalogProductRecord = {
  id: string;
  merchantCategoryId: string;
  categoryName: string;
  name: string;
  description: string;
  priceCents: number;
  active: boolean;
  available: boolean;
  stockMode: string;
  stockQuantity: number | null;
  sortOrder: number;
  imagePath: string | null;
  optionGroupCount: number;
};

export type CatalogCategoryRecord = {
  id: string;
  name: string;
  sortOrder: number;
};

export type CatalogOptionGroupRecord = {
  id: string;
  productId: string;
  name: string;
  selectionMode: string;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
};

export type CatalogOptionChoiceRecord = {
  id: string;
  groupId: string;
  name: string;
  priceDeltaCents: number;
  sortOrder: number;
};

export type CatalogDeliveryRecord = {
  zoneId: string;
  deliveryFeeCents: number;
  minimumOrderCents: number;
  estimatedMinutes: number;
  active: boolean;
};

export type CatalogPaymentRecord = {
  code: string;
  label: string;
  instructions: string;
};

export type CatalogOpeningRecord = {
  weekday: number;
  openMinute: number;
  closeMinute: number;
};

export type GetPublicMerchantCatalogDeps = {
  findActiveMerchantById: (
    merchantId: string,
  ) => Promise<CatalogMerchantRecord | null>;
  listActiveCategories: (
    merchantId: string,
  ) => Promise<CatalogCategoryRecord[]>;
  listActiveProducts: (merchantId: string) => Promise<CatalogProductRecord[]>;
  listActiveOptionGroups: (
    merchantId: string,
    productIds: string[],
  ) => Promise<CatalogOptionGroupRecord[]>;
  listActiveOptionChoices: (
    groupIds: string[],
  ) => Promise<CatalogOptionChoiceRecord[]>;
  listDeliveryZones: (
    merchantId: string,
    customerZoneId?: string,
  ) => Promise<CatalogDeliveryRecord[]>;
  listPaymentMethods: (merchantId: string) => Promise<CatalogPaymentRecord[]>;
  listOpeningIntervals: (merchantId: string) => Promise<CatalogOpeningRecord[]>;
  createSignedUrls: (
    imagePaths: readonly string[],
  ) => Promise<Map<string, string>>;
  createCoverSignedUrls: (
    coverPaths: readonly string[],
  ) => Promise<Map<string, string>>;
  now: () => Date;
};

export async function getPublicMerchantCatalog(
  merchantId: string,
  customerZoneId: string | null | undefined,
  deps: GetPublicMerchantCatalogDeps,
): Promise<PublicMerchantPage | null> {
  if (!isValidUuid(merchantId)) {
    return null;
  }

  const merchant = await deps.findActiveMerchantById(merchantId);
  if (!merchant || merchant.status !== "ACTIVE") {
    return null;
  }

  const zoneId =
    customerZoneId && isValidUuid(customerZoneId)
      ? customerZoneId
      : merchant.zoneId;

  const [categories, products, payments, openings, deliveries] =
    await Promise.all([
      deps.listActiveCategories(merchantId),
      deps.listActiveProducts(merchantId),
      deps.listPaymentMethods(merchantId),
      deps.listOpeningIntervals(merchantId),
      deps.listDeliveryZones(merchantId, zoneId),
    ]);

  const visibleProducts = products.filter(
    (product) => getPublicProductPurchasePresentation(product).visible,
  );
  const productIds = visibleProducts.map((p) => p.id);
  const optionGroups = await deps.listActiveOptionGroups(
    merchantId,
    productIds,
  );
  const groupIds = optionGroups.map((g) => g.id);
  const choices = await deps.listActiveOptionChoices(groupIds);

  const imagePaths = visibleProducts
    .map((p) => p.imagePath)
    .filter((path): path is string => Boolean(path));
  const coverPaths = merchant.coverImagePath ? [merchant.coverImagePath] : [];
  const [signedUrls, coverUrls] = await Promise.all([
    deps.createSignedUrls(imagePaths),
    deps.createCoverSignedUrls(coverPaths),
  ]);

  const now = deps.now();
  const operationalStatus = getMerchantOperationalStatus(
    {
      status: merchant.status as MerchantStatus,
      acceptingOrders: merchant.acceptingOrders,
      pausedUntil: merchant.pausedUntil,
    } satisfies MerchantOperationalFields,
    now,
  );
  const availability =
    getPublicMerchantAvailabilityPresentation(operationalStatus);

  const intervals = openings.map((row): MerchantOpeningInterval => ({
    merchantId: merchant.id,
    weekday: row.weekday as MerchantOpeningInterval["weekday"],
    openMinute: row.openMinute,
    closeMinute: row.closeMinute,
  }));
  const hoursOpenState = getMerchantHoursOpenState({
    intervals,
    timezone: merchant.cityTimezone,
    now,
  });
  const hours = getPublicHoursPresentation({
    intervals,
    timezone: merchant.cityTimezone,
    now,
  });

  const delivery = deliveries.find((row) => row.active) ?? null;

  const groupsByProduct = new Map<string, PublicOptionGroupView[]>();
  for (const group of optionGroups) {
    const groupChoices = choices
      .filter((choice) => choice.groupId === group.id)
      .map((choice) => ({
        id: choice.id,
        name: choice.name,
        priceDeltaCents: choice.priceDeltaCents,
        priceDeltaLabel:
          choice.priceDeltaCents === 0
            ? null
            : formatMoneyCentsArs(moneyCents(choice.priceDeltaCents)),
      }));

    const view: PublicOptionGroupView = {
      id: group.id,
      name: group.name,
      selectionMode: group.selectionMode,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      modeLabel: getPublicOptionGroupModeLabel(group.selectionMode),
      hint: getPublicOptionGroupHint({
        selectionMode: group.selectionMode,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
      }),
      choices: groupChoices,
    };

    const list = groupsByProduct.get(group.productId) ?? [];
    list.push(view);
    groupsByProduct.set(group.productId, list);
  }

  const merchantAcceptingOrders =
    availability.tone === "available" && hoursOpenState !== "closed";
  const merchantUnavailableLabel =
    availability.tone !== "available"
      ? availability.label
      : hoursOpenState === "closed"
        ? "Cerrado"
        : null;

  const productCards: PublicProductCard[] = visibleProducts.map((product) => {
    const purchase = getPublicProductPurchasePresentation(product);
    const groups = groupsByProduct.get(product.id) ?? [];
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      categoryId: product.merchantCategoryId,
      categoryName: product.categoryName,
      priceCents: product.priceCents,
      priceLabel: formatMoneyCentsArs(moneyCents(product.priceCents)),
      sellable: purchase.sellable,
      canAddToCart: purchase.sellable && merchantAcceptingOrders,
      statusLabel:
        purchase.statusLabel ??
        (!merchantAcceptingOrders ? merchantUnavailableLabel : null),
      stockMode: product.stockMode,
      stockQuantity: product.stockQuantity,
      imageUrl: product.imagePath
        ? (signedUrls.get(product.imagePath) ?? null)
        : null,
      hasOptions: groups.length > 0 || product.optionGroupCount > 0,
      optionGroups: groups,
    };
  });

  const categoryIdsWithProducts = new Set(
    productCards.map((product) => product.categoryId),
  );

  return {
    id: merchant.id,
    name: merchant.name,
    description: merchant.description,
    zoneName: merchant.zoneName,
    cityName: merchant.cityName,
    availabilityLabel: availability.label,
    availabilityTone: availability.tone,
    hoursLabel: hours?.label ?? null,
    hoursDetail: hours?.detail ?? null,
    logistics: buildPublicLogisticsPresentation({
      merchantZoneId: merchant.zoneId,
      customerZoneId: zoneId,
      pickupEnabled: merchant.pickupEnabled,
      merchantDeliveryEnabled: merchant.merchantDeliveryEnabled,
      preparationMinutes: merchant.preparationMinutes,
      deliveryForCustomerZone: delivery
        ? {
            deliveryFeeCents: delivery.deliveryFeeCents,
            minimumOrderCents: delivery.minimumOrderCents,
            estimatedMinutes: delivery.estimatedMinutes,
          }
        : null,
    }),
    paymentMethods: payments.map((method) => ({
      code: method.code,
      label: method.label,
      instructions: method.instructions.trim() ? method.instructions : null,
    })),
    categories: categories
      .filter((category) => categoryIdsWithProducts.has(category.id))
      .map((category) => ({ id: category.id, name: category.name })),
    products: productCards,
    coverUrl: merchant.coverImagePath
      ? (coverUrls.get(merchant.coverImagePath) ?? null)
      : null,
  };
}
