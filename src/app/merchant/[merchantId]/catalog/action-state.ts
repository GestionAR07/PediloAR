export type CatalogActionState = {
  error: string | null;
  success: string | null;
};

export const initialCatalogActionState: CatalogActionState = {
  error: null,
  success: null,
};
