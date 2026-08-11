/**
 * Stable conceptual identifiers.
 * Generation and persistence arrive in Phase 2B — domain only types them.
 */
export type EntityId = string;

export type ProvinceId = EntityId;
export type CityId = EntityId;
export type ZoneId = EntityId;

export type MerchantId = EntityId;
export type UserId = EntityId;
export type MerchantUserId = EntityId;

export type MarketplaceCategoryId = EntityId;
export type MerchantCategoryId = EntityId;
export type ProductId = EntityId;
export type ProductOptionGroupId = EntityId;
export type ProductOptionChoiceId = EntityId;

export type OrderId = EntityId;
export type OrderItemId = EntityId;
export type OrderEventId = EntityId;
export type DeliveryId = EntityId;

/** Client-supplied; shape validated by parseIdempotencyKey. UNIQUE in Phase 2B. */
export type IdempotencyKey = string;
