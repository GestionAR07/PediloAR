export type CatalogApplicationError = {
  code: string;
  message: string;
};

export type CatalogAuthDeps = {
  requireCatalogAccess: (merchantId: string) => Promise<void>;
};

export const CATALOG_ALLOWED_ROLES = ["OWNER", "STAFF"] as const;
