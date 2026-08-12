export type ProductSaveFeedbackKind = "created" | "saved";

export function parseProductSaveFeedback(searchParams: {
  created?: string;
  saved?: string;
}): ProductSaveFeedbackKind | null {
  if (searchParams.created === "1") {
    return "created";
  }
  if (searchParams.saved === "1") {
    return "saved";
  }
  return null;
}

export function productEditPath(
  merchantId: string,
  productId: string,
  feedback?: ProductSaveFeedbackKind,
): string {
  const base = `/merchant/${merchantId}/catalog/products/${productId}`;
  if (!feedback) {
    return base;
  }
  return `${base}?${feedback}=1`;
}

export function productSaveFeedbackMessage(kind: ProductSaveFeedbackKind): {
  title: string;
  detail: string | null;
} {
  if (kind === "created") {
    return {
      title: "Producto creado correctamente.",
      detail: "Ya podés configurar opciones y variedades.",
    };
  }
  return {
    title: "Cambios guardados.",
    detail: null,
  };
}
