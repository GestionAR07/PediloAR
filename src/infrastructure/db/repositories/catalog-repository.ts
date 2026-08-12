import "server-only";

import { and, asc, count, eq, ilike, sql } from "drizzle-orm";
import { getDb } from "../client";
import { moneyCents } from "@/domain/money/money-cents";
import {
  merchantCategories,
  productOptionChoices,
  productOptionGroups,
  products,
} from "../schema";

export type MerchantCategoryRecord = {
  id: string;
  merchantId: string;
  name: string;
  sortOrder: number;
  active: boolean;
};

export type ProductRecord = {
  id: string;
  merchantId: string;
  merchantCategoryId: string;
  name: string;
  description: string;
  priceCents: number;
  active: boolean;
  available: boolean;
  stockMode: string;
  stockQuantity: number | null;
  sortOrder: number;
  imagePath: string | null;
};

export type ProductListRow = ProductRecord & {
  categoryName: string;
  categoryActive: boolean;
  optionGroupCount: number;
};

export type ProductOptionGroupRecord = {
  id: string;
  productId: string;
  name: string;
  selectionMode: string;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  active: boolean;
};

export type ProductOptionChoiceRecord = {
  id: string;
  groupId: string;
  name: string;
  priceDeltaCents: number;
  sortOrder: number;
  active: boolean;
};

export type ProductListFilters = {
  search?: string;
  categoryId?: string;
  available?: boolean;
};

export async function listMerchantCategories(
  merchantId: string,
): Promise<MerchantCategoryRecord[]> {
  const db = getDb();
  return db
    .select({
      id: merchantCategories.id,
      merchantId: merchantCategories.merchantId,
      name: merchantCategories.name,
      sortOrder: merchantCategories.sortOrder,
      active: merchantCategories.active,
    })
    .from(merchantCategories)
    .where(eq(merchantCategories.merchantId, merchantId))
    .orderBy(asc(merchantCategories.sortOrder), asc(merchantCategories.name));
}

export async function listActiveMerchantCategories(
  merchantId: string,
): Promise<MerchantCategoryRecord[]> {
  const db = getDb();
  return db
    .select({
      id: merchantCategories.id,
      merchantId: merchantCategories.merchantId,
      name: merchantCategories.name,
      sortOrder: merchantCategories.sortOrder,
      active: merchantCategories.active,
    })
    .from(merchantCategories)
    .where(
      and(
        eq(merchantCategories.merchantId, merchantId),
        eq(merchantCategories.active, true),
      ),
    )
    .orderBy(asc(merchantCategories.sortOrder), asc(merchantCategories.name));
}

export async function findMerchantCategoryById(
  merchantId: string,
  categoryId: string,
): Promise<MerchantCategoryRecord | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: merchantCategories.id,
      merchantId: merchantCategories.merchantId,
      name: merchantCategories.name,
      sortOrder: merchantCategories.sortOrder,
      active: merchantCategories.active,
    })
    .from(merchantCategories)
    .where(
      and(
        eq(merchantCategories.id, categoryId),
        eq(merchantCategories.merchantId, merchantId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function countProductsInCategory(
  merchantId: string,
  categoryId: string,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ total: count() })
    .from(products)
    .where(
      and(
        eq(products.merchantId, merchantId),
        eq(products.merchantCategoryId, categoryId),
      ),
    );
  return Number(rows[0]?.total ?? 0);
}

export async function nextCategorySortOrder(
  merchantId: string,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({
      max: sql<number>`coalesce(max(${merchantCategories.sortOrder}), -1)`,
    })
    .from(merchantCategories)
    .where(eq(merchantCategories.merchantId, merchantId));
  return Number(rows[0]?.max ?? -1) + 1;
}

export async function insertMerchantCategory(input: {
  merchantId: string;
  name: string;
  sortOrder: number;
  active?: boolean;
}): Promise<MerchantCategoryRecord> {
  const db = getDb();
  const inserted = await db
    .insert(merchantCategories)
    .values({
      merchantId: input.merchantId,
      name: input.name,
      sortOrder: input.sortOrder,
      active: input.active ?? true,
    })
    .returning({
      id: merchantCategories.id,
      merchantId: merchantCategories.merchantId,
      name: merchantCategories.name,
      sortOrder: merchantCategories.sortOrder,
      active: merchantCategories.active,
    });
  const row = inserted[0];
  if (!row) {
    throw new Error("Failed to insert merchant category");
  }
  return row;
}

export async function updateMerchantCategory(
  merchantId: string,
  categoryId: string,
  patch: { name?: string; active?: boolean; sortOrder?: number },
): Promise<MerchantCategoryRecord | null> {
  const db = getDb();
  const updated = await db
    .update(merchantCategories)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(merchantCategories.id, categoryId),
        eq(merchantCategories.merchantId, merchantId),
      ),
    )
    .returning({
      id: merchantCategories.id,
      merchantId: merchantCategories.merchantId,
      name: merchantCategories.name,
      sortOrder: merchantCategories.sortOrder,
      active: merchantCategories.active,
    });
  return updated[0] ?? null;
}

export async function deleteMerchantCategory(
  merchantId: string,
  categoryId: string,
): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(merchantCategories)
    .where(
      and(
        eq(merchantCategories.id, categoryId),
        eq(merchantCategories.merchantId, merchantId),
      ),
    )
    .returning({ id: merchantCategories.id });
  return deleted.length > 0;
}

export async function listProductsForMerchant(
  merchantId: string,
  filters: ProductListFilters = {},
): Promise<ProductListRow[]> {
  const db = getDb();

  const optionCounts = db
    .select({
      productId: productOptionGroups.productId,
      optionGroupCount: count(productOptionGroups.id).as("option_group_count"),
    })
    .from(productOptionGroups)
    .groupBy(productOptionGroups.productId)
    .as("option_counts");

  const conditions = [eq(products.merchantId, merchantId)];

  if (filters.categoryId) {
    conditions.push(eq(products.merchantCategoryId, filters.categoryId));
  }
  if (filters.available !== undefined) {
    conditions.push(eq(products.available, filters.available));
  }
  if (filters.search?.trim()) {
    conditions.push(ilike(products.name, `%${filters.search.trim()}%`));
  }

  const rows = await db
    .select({
      id: products.id,
      merchantId: products.merchantId,
      merchantCategoryId: products.merchantCategoryId,
      name: products.name,
      description: products.description,
      priceCents: products.priceCents,
      active: products.active,
      available: products.available,
      stockMode: products.stockMode,
      stockQuantity: products.stockQuantity,
      sortOrder: products.sortOrder,
      imagePath: products.imagePath,
      categoryName: merchantCategories.name,
      categoryActive: merchantCategories.active,
      optionGroupCount: optionCounts.optionGroupCount,
    })
    .from(products)
    .innerJoin(
      merchantCategories,
      and(
        eq(merchantCategories.id, products.merchantCategoryId),
        eq(merchantCategories.merchantId, merchantId),
      ),
    )
    .leftJoin(optionCounts, eq(optionCounts.productId, products.id))
    .where(and(...conditions))
    .orderBy(
      asc(merchantCategories.sortOrder),
      asc(products.sortOrder),
      asc(products.name),
    );

  return rows.map((row) => ({
    id: row.id,
    merchantId: row.merchantId,
    merchantCategoryId: row.merchantCategoryId,
    name: row.name,
    description: row.description,
    priceCents: Number(row.priceCents),
    active: row.active,
    available: row.available,
    stockMode: row.stockMode,
    stockQuantity: row.stockQuantity,
    sortOrder: row.sortOrder,
    imagePath: row.imagePath,
    categoryName: row.categoryName,
    categoryActive: row.categoryActive,
    optionGroupCount: Number(row.optionGroupCount ?? 0),
  }));
}

export async function findProductById(
  merchantId: string,
  productId: string,
): Promise<ProductRecord | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: products.id,
      merchantId: products.merchantId,
      merchantCategoryId: products.merchantCategoryId,
      name: products.name,
      description: products.description,
      priceCents: products.priceCents,
      active: products.active,
      available: products.available,
      stockMode: products.stockMode,
      stockQuantity: products.stockQuantity,
      sortOrder: products.sortOrder,
      imagePath: products.imagePath,
    })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.merchantId, merchantId)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }
  return { ...row, priceCents: Number(row.priceCents) };
}

export async function nextProductSortOrder(
  merchantId: string,
  categoryId: string,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ max: sql<number>`coalesce(max(${products.sortOrder}), -1)` })
    .from(products)
    .where(
      and(
        eq(products.merchantId, merchantId),
        eq(products.merchantCategoryId, categoryId),
      ),
    );
  return Number(rows[0]?.max ?? -1) + 1;
}

export async function insertProduct(input: {
  merchantId: string;
  merchantCategoryId: string;
  name: string;
  description: string;
  priceCents: number;
  active?: boolean;
  available?: boolean;
  stockMode: string;
  stockQuantity: number | null;
  sortOrder: number;
}): Promise<ProductRecord> {
  const db = getDb();
  const inserted = await db
    .insert(products)
    .values({
      merchantId: input.merchantId,
      merchantCategoryId: input.merchantCategoryId,
      name: input.name,
      description: input.description,
      priceCents: moneyCents(input.priceCents),
      active: input.active ?? true,
      available: input.available ?? true,
      stockMode: input.stockMode,
      stockQuantity: input.stockQuantity,
      sortOrder: input.sortOrder,
    })
    .returning({
      id: products.id,
      merchantId: products.merchantId,
      merchantCategoryId: products.merchantCategoryId,
      name: products.name,
      description: products.description,
      priceCents: products.priceCents,
      active: products.active,
      available: products.available,
      stockMode: products.stockMode,
      stockQuantity: products.stockQuantity,
      sortOrder: products.sortOrder,
      imagePath: products.imagePath,
    });

  const row = inserted[0];
  if (!row) {
    throw new Error("Failed to insert product");
  }
  return { ...row, priceCents: Number(row.priceCents) };
}

export async function updateProduct(
  merchantId: string,
  productId: string,
  patch: {
    merchantCategoryId?: string;
    name?: string;
    description?: string;
    priceCents?: number;
    active?: boolean;
    available?: boolean;
    stockMode?: string;
    stockQuantity?: number | null;
    sortOrder?: number;
  },
): Promise<ProductRecord | null> {
  const db = getDb();
  const updated = await db
    .update(products)
    .set({
      ...(patch.merchantCategoryId !== undefined
        ? { merchantCategoryId: patch.merchantCategoryId }
        : {}),
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description }
        : {}),
      ...(patch.priceCents !== undefined
        ? { priceCents: moneyCents(patch.priceCents) }
        : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.available !== undefined ? { available: patch.available } : {}),
      ...(patch.stockMode !== undefined ? { stockMode: patch.stockMode } : {}),
      ...(patch.stockQuantity !== undefined
        ? { stockQuantity: patch.stockQuantity }
        : {}),
      ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(products.id, productId), eq(products.merchantId, merchantId)))
    .returning({
      id: products.id,
      merchantId: products.merchantId,
      merchantCategoryId: products.merchantCategoryId,
      name: products.name,
      description: products.description,
      priceCents: products.priceCents,
      active: products.active,
      available: products.available,
      stockMode: products.stockMode,
      stockQuantity: products.stockQuantity,
      sortOrder: products.sortOrder,
      imagePath: products.imagePath,
    });

  const row = updated[0];
  if (!row) {
    return null;
  }
  return { ...row, priceCents: Number(row.priceCents) };
}

export async function setProductImagePath(
  merchantId: string,
  productId: string,
  imagePath: string | null,
): Promise<ProductRecord | null> {
  const db = getDb();
  const updated = await db
    .update(products)
    .set({
      imagePath,
      updatedAt: new Date(),
    })
    .where(and(eq(products.id, productId), eq(products.merchantId, merchantId)))
    .returning({
      id: products.id,
      merchantId: products.merchantId,
      merchantCategoryId: products.merchantCategoryId,
      name: products.name,
      description: products.description,
      priceCents: products.priceCents,
      active: products.active,
      available: products.available,
      stockMode: products.stockMode,
      stockQuantity: products.stockQuantity,
      sortOrder: products.sortOrder,
      imagePath: products.imagePath,
    });

  const row = updated[0];
  if (!row) {
    return null;
  }
  return { ...row, priceCents: Number(row.priceCents) };
}

export async function setProductAvailability(
  merchantId: string,
  productId: string,
  available: boolean,
): Promise<ProductRecord | null> {
  return updateProduct(merchantId, productId, { available });
}

export async function listOptionGroupsForProduct(
  merchantId: string,
  productId: string,
): Promise<ProductOptionGroupRecord[]> {
  const db = getDb();
  return db
    .select({
      id: productOptionGroups.id,
      productId: productOptionGroups.productId,
      name: productOptionGroups.name,
      selectionMode: productOptionGroups.selectionMode,
      minSelections: productOptionGroups.minSelections,
      maxSelections: productOptionGroups.maxSelections,
      sortOrder: productOptionGroups.sortOrder,
      active: productOptionGroups.active,
    })
    .from(productOptionGroups)
    .innerJoin(products, eq(products.id, productOptionGroups.productId))
    .where(
      and(
        eq(productOptionGroups.productId, productId),
        eq(products.merchantId, merchantId),
      ),
    )
    .orderBy(asc(productOptionGroups.sortOrder), asc(productOptionGroups.name));
}

export async function listOptionChoicesForGroups(
  groupIds: string[],
): Promise<ProductOptionChoiceRecord[]> {
  if (groupIds.length === 0) {
    return [];
  }
  const db = getDb();
  const rows: ProductOptionChoiceRecord[] = [];
  for (const groupId of groupIds) {
    const choices = await db
      .select({
        id: productOptionChoices.id,
        groupId: productOptionChoices.groupId,
        name: productOptionChoices.name,
        priceDeltaCents: productOptionChoices.priceDeltaCents,
        sortOrder: productOptionChoices.sortOrder,
        active: productOptionChoices.active,
      })
      .from(productOptionChoices)
      .where(eq(productOptionChoices.groupId, groupId))
      .orderBy(
        asc(productOptionChoices.sortOrder),
        asc(productOptionChoices.name),
      );
    rows.push(
      ...choices.map((c) => ({
        ...c,
        priceDeltaCents: Number(c.priceDeltaCents),
      })),
    );
  }
  return rows;
}

export async function findOptionGroupById(
  merchantId: string,
  groupId: string,
): Promise<(ProductOptionGroupRecord & { merchantId: string }) | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: productOptionGroups.id,
      productId: productOptionGroups.productId,
      name: productOptionGroups.name,
      selectionMode: productOptionGroups.selectionMode,
      minSelections: productOptionGroups.minSelections,
      maxSelections: productOptionGroups.maxSelections,
      sortOrder: productOptionGroups.sortOrder,
      active: productOptionGroups.active,
      merchantId: products.merchantId,
    })
    .from(productOptionGroups)
    .innerJoin(products, eq(products.id, productOptionGroups.productId))
    .where(
      and(
        eq(productOptionGroups.id, groupId),
        eq(products.merchantId, merchantId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function findOptionChoiceById(
  merchantId: string,
  choiceId: string,
): Promise<
  (ProductOptionChoiceRecord & { merchantId: string; productId: string }) | null
> {
  const db = getDb();
  const rows = await db
    .select({
      id: productOptionChoices.id,
      groupId: productOptionChoices.groupId,
      name: productOptionChoices.name,
      priceDeltaCents: productOptionChoices.priceDeltaCents,
      sortOrder: productOptionChoices.sortOrder,
      active: productOptionChoices.active,
      merchantId: products.merchantId,
      productId: products.id,
    })
    .from(productOptionChoices)
    .innerJoin(
      productOptionGroups,
      eq(productOptionGroups.id, productOptionChoices.groupId),
    )
    .innerJoin(products, eq(products.id, productOptionGroups.productId))
    .where(
      and(
        eq(productOptionChoices.id, choiceId),
        eq(products.merchantId, merchantId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }
  return { ...row, priceDeltaCents: Number(row.priceDeltaCents) };
}

export async function nextOptionGroupSortOrder(
  productId: string,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({
      max: sql<number>`coalesce(max(${productOptionGroups.sortOrder}), -1)`,
    })
    .from(productOptionGroups)
    .where(eq(productOptionGroups.productId, productId));
  return Number(rows[0]?.max ?? -1) + 1;
}

export async function nextOptionChoiceSortOrder(
  groupId: string,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({
      max: sql<number>`coalesce(max(${productOptionChoices.sortOrder}), -1)`,
    })
    .from(productOptionChoices)
    .where(eq(productOptionChoices.groupId, groupId));
  return Number(rows[0]?.max ?? -1) + 1;
}

export async function insertOptionGroup(input: {
  productId: string;
  name: string;
  selectionMode: string;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  active?: boolean;
}): Promise<ProductOptionGroupRecord> {
  const db = getDb();
  const inserted = await db
    .insert(productOptionGroups)
    .values({
      productId: input.productId,
      name: input.name,
      selectionMode: input.selectionMode,
      minSelections: input.minSelections,
      maxSelections: input.maxSelections,
      sortOrder: input.sortOrder,
      active: input.active ?? true,
    })
    .returning({
      id: productOptionGroups.id,
      productId: productOptionGroups.productId,
      name: productOptionGroups.name,
      selectionMode: productOptionGroups.selectionMode,
      minSelections: productOptionGroups.minSelections,
      maxSelections: productOptionGroups.maxSelections,
      sortOrder: productOptionGroups.sortOrder,
      active: productOptionGroups.active,
    });
  const row = inserted[0];
  if (!row) {
    throw new Error("Failed to insert option group");
  }
  return row;
}

export async function updateOptionGroup(
  merchantId: string,
  groupId: string,
  patch: {
    name?: string;
    selectionMode?: string;
    minSelections?: number;
    maxSelections?: number;
    sortOrder?: number;
    active?: boolean;
  },
): Promise<ProductOptionGroupRecord | null> {
  const existing = await findOptionGroupById(merchantId, groupId);
  if (!existing) {
    return null;
  }

  const db = getDb();
  const updated = await db
    .update(productOptionGroups)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.selectionMode !== undefined
        ? { selectionMode: patch.selectionMode }
        : {}),
      ...(patch.minSelections !== undefined
        ? { minSelections: patch.minSelections }
        : {}),
      ...(patch.maxSelections !== undefined
        ? { maxSelections: patch.maxSelections }
        : {}),
      ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      updatedAt: new Date(),
    })
    .where(eq(productOptionGroups.id, groupId))
    .returning({
      id: productOptionGroups.id,
      productId: productOptionGroups.productId,
      name: productOptionGroups.name,
      selectionMode: productOptionGroups.selectionMode,
      minSelections: productOptionGroups.minSelections,
      maxSelections: productOptionGroups.maxSelections,
      sortOrder: productOptionGroups.sortOrder,
      active: productOptionGroups.active,
    });
  return updated[0] ?? null;
}

export async function insertOptionChoice(input: {
  groupId: string;
  name: string;
  priceDeltaCents: number;
  sortOrder: number;
  active?: boolean;
}): Promise<ProductOptionChoiceRecord> {
  const db = getDb();
  const inserted = await db
    .insert(productOptionChoices)
    .values({
      groupId: input.groupId,
      name: input.name,
      priceDeltaCents: moneyCents(input.priceDeltaCents),
      sortOrder: input.sortOrder,
      active: input.active ?? true,
    })
    .returning({
      id: productOptionChoices.id,
      groupId: productOptionChoices.groupId,
      name: productOptionChoices.name,
      priceDeltaCents: productOptionChoices.priceDeltaCents,
      sortOrder: productOptionChoices.sortOrder,
      active: productOptionChoices.active,
    });
  const row = inserted[0];
  if (!row) {
    throw new Error("Failed to insert option choice");
  }
  return { ...row, priceDeltaCents: Number(row.priceDeltaCents) };
}

export async function updateOptionChoice(
  merchantId: string,
  choiceId: string,
  patch: {
    name?: string;
    priceDeltaCents?: number;
    sortOrder?: number;
    active?: boolean;
  },
): Promise<ProductOptionChoiceRecord | null> {
  const existing = await findOptionChoiceById(merchantId, choiceId);
  if (!existing) {
    return null;
  }

  const db = getDb();
  const updated = await db
    .update(productOptionChoices)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.priceDeltaCents !== undefined
        ? { priceDeltaCents: moneyCents(patch.priceDeltaCents) }
        : {}),
      ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      updatedAt: new Date(),
    })
    .where(eq(productOptionChoices.id, choiceId))
    .returning({
      id: productOptionChoices.id,
      groupId: productOptionChoices.groupId,
      name: productOptionChoices.name,
      priceDeltaCents: productOptionChoices.priceDeltaCents,
      sortOrder: productOptionChoices.sortOrder,
      active: productOptionChoices.active,
    });

  const row = updated[0];
  if (!row) {
    return null;
  }
  return { ...row, priceDeltaCents: Number(row.priceDeltaCents) };
}

export async function swapCategorySortOrder(
  merchantId: string,
  categoryId: string,
  direction: "up" | "down",
): Promise<boolean> {
  const categories = await listMerchantCategories(merchantId);
  const index = categories.findIndex((c) => c.id === categoryId);
  if (index < 0) {
    return false;
  }
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= categories.length) {
    return false;
  }

  const current = categories[index]!;
  const neighbor = categories[swapIndex]!;
  const db = getDb();

  await db.transaction(async (tx) => {
    await tx
      .update(merchantCategories)
      .set({ sortOrder: neighbor.sortOrder, updatedAt: new Date() })
      .where(eq(merchantCategories.id, current.id));
    await tx
      .update(merchantCategories)
      .set({ sortOrder: current.sortOrder, updatedAt: new Date() })
      .where(eq(merchantCategories.id, neighbor.id));
  });

  return true;
}

export async function swapProductSortOrder(
  merchantId: string,
  productId: string,
  direction: "up" | "down",
): Promise<boolean> {
  const product = await findProductById(merchantId, productId);
  if (!product) {
    return false;
  }

  const db = getDb();
  const siblings = await db
    .select({
      id: products.id,
      sortOrder: products.sortOrder,
    })
    .from(products)
    .where(
      and(
        eq(products.merchantId, merchantId),
        eq(products.merchantCategoryId, product.merchantCategoryId),
      ),
    )
    .orderBy(asc(products.sortOrder), asc(products.name));

  const index = siblings.findIndex((p) => p.id === productId);
  if (index < 0) {
    return false;
  }
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= siblings.length) {
    return false;
  }

  const current = siblings[index]!;
  const neighbor = siblings[swapIndex]!;

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({ sortOrder: neighbor.sortOrder, updatedAt: new Date() })
      .where(eq(products.id, current.id));
    await tx
      .update(products)
      .set({ sortOrder: current.sortOrder, updatedAt: new Date() })
      .where(eq(products.id, neighbor.id));
  });

  return true;
}
