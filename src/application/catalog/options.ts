import {
  assertOptionChoice,
  assertOptionGroup,
} from "@/domain/catalog/options";
import {
  OPTION_SELECTION_MODES,
  type OptionSelectionMode,
} from "@/domain/catalog/enums";
import { moneyCents } from "@/domain/money/money-cents";
import { DomainError } from "@/domain/shared/errors";
import { err, ok, type Result } from "@/domain/shared/result";
import { parseMoneyInputToCents } from "@/lib/parse-money";
import { isValidUuid } from "@/lib/uuid";
import type { CatalogApplicationError, CatalogAuthDeps } from "./types";

export type OptionDeps = CatalogAuthDeps & {
  findProductById: (
    merchantId: string,
    productId: string,
  ) => Promise<{ id: string } | null>;
  findOptionGroupById: (
    merchantId: string,
    groupId: string,
  ) => Promise<{
    id: string;
    productId: string;
    name: string;
    selectionMode: string;
    minSelections: number;
    maxSelections: number;
    sortOrder: number;
    active: boolean;
  } | null>;
  findOptionChoiceById: (
    merchantId: string,
    choiceId: string,
  ) => Promise<{ id: string; groupId: string } | null>;
  nextOptionGroupSortOrder: (productId: string) => Promise<number>;
  nextOptionChoiceSortOrder: (groupId: string) => Promise<number>;
  insertOptionGroup: (input: {
    productId: string;
    name: string;
    selectionMode: string;
    minSelections: number;
    maxSelections: number;
    sortOrder: number;
    active?: boolean;
  }) => Promise<{ id: string }>;
  updateOptionGroup: (
    merchantId: string,
    groupId: string,
    patch: Record<string, unknown>,
  ) => Promise<{ id: string } | null>;
  insertOptionChoice: (input: {
    groupId: string;
    name: string;
    priceDeltaCents: number;
    sortOrder: number;
    active?: boolean;
  }) => Promise<{ id: string }>;
  updateOptionChoice: (
    merchantId: string,
    choiceId: string,
    patch: Record<string, unknown>,
  ) => Promise<{ id: string } | null>;
};

function parseSelectionMode(value: string): OptionSelectionMode | null {
  return OPTION_SELECTION_MODES.includes(value as OptionSelectionMode)
    ? (value as OptionSelectionMode)
    : null;
}

function defaultBoundsForMode(mode: OptionSelectionMode): {
  minSelections: number;
  maxSelections: number;
} {
  switch (mode) {
    case "SINGLE":
      return { minSelections: 0, maxSelections: 1 };
    case "MULTIPLE":
      return { minSelections: 0, maxSelections: 10 };
    case "QUANTITY":
      return { minSelections: 1, maxSelections: 24 };
  }
}

function validateOptionName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return "El nombre es obligatorio.";
  }
  if (trimmed.length > 120) {
    return "El nombre es demasiado largo.";
  }
  return null;
}

export async function createOptionGroup(
  merchantId: string,
  input: {
    productId: string;
    name: string;
    selectionMode: string;
    minSelections?: number;
    maxSelections?: number;
  },
  deps: OptionDeps,
): Promise<Result<{ id: string }, CatalogApplicationError>> {
  await deps.requireCatalogAccess(merchantId);

  if (!isValidUuid(input.productId)) {
    return err({
      code: "PRODUCT_NOT_FOUND",
      message: "El producto no existe.",
    });
  }

  const product = await deps.findProductById(merchantId, input.productId);
  if (!product) {
    return err({
      code: "PRODUCT_NOT_FOUND",
      message: "El producto no pertenece a este comercio.",
    });
  }

  const nameError = validateOptionName(input.name);
  if (nameError) {
    return err({ code: "INVALID_NAME", message: nameError });
  }

  const mode = parseSelectionMode(input.selectionMode);
  if (!mode) {
    return err({
      code: "INVALID_MODE",
      message: "El modo de opción no es válido.",
    });
  }

  const defaults = defaultBoundsForMode(mode);
  const minSelections = input.minSelections ?? defaults.minSelections;
  const maxSelections = input.maxSelections ?? defaults.maxSelections;

  const draft = {
    id: "draft" as const,
    productId: input.productId,
    name: input.name.trim(),
    selectionMode: mode,
    minSelections,
    maxSelections,
    sortOrder: 0,
    active: true,
  };

  try {
    assertOptionGroup(draft);
  } catch (error) {
    if (error instanceof DomainError) {
      return err({ code: error.code, message: error.message });
    }
    return err({
      code: "INVALID_GROUP",
      message: "Los datos del grupo no son válidos.",
    });
  }

  const sortOrder = await deps.nextOptionGroupSortOrder(input.productId);
  const group = await deps.insertOptionGroup({
    productId: input.productId,
    name: input.name.trim(),
    selectionMode: mode,
    minSelections,
    maxSelections,
    sortOrder,
    active: true,
  });

  return ok({ id: group.id });
}

export async function updateOptionGroup(
  merchantId: string,
  groupId: string,
  input: {
    name?: string;
    selectionMode?: string;
    minSelections?: number;
    maxSelections?: number;
    active?: boolean;
  },
  deps: OptionDeps,
): Promise<Result<{ id: string }, CatalogApplicationError>> {
  await deps.requireCatalogAccess(merchantId);

  if (!isValidUuid(groupId)) {
    return err({
      code: "GROUP_NOT_FOUND",
      message: "El grupo de opciones no existe.",
    });
  }

  const existing = await deps.findOptionGroupById(merchantId, groupId);
  if (!existing) {
    return err({
      code: "GROUP_NOT_FOUND",
      message: "El grupo de opciones no existe.",
    });
  }

  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const nameError = validateOptionName(input.name);
    if (nameError) {
      return err({ code: "INVALID_NAME", message: nameError });
    }
    patch.name = input.name.trim();
  }

  let mode = existing.selectionMode as OptionSelectionMode;
  if (input.selectionMode !== undefined) {
    const parsed = parseSelectionMode(input.selectionMode);
    if (!parsed) {
      return err({
        code: "INVALID_MODE",
        message: "El modo de opción no es válido.",
      });
    }
    mode = parsed;
    patch.selectionMode = parsed;
  }

  const minSelections = input.minSelections ?? existing.minSelections;
  const maxSelections = input.maxSelections ?? existing.maxSelections;
  if (
    input.minSelections !== undefined ||
    input.maxSelections !== undefined ||
    input.selectionMode !== undefined
  ) {
    patch.minSelections = minSelections;
    patch.maxSelections = maxSelections;
  }

  if (input.active !== undefined) {
    patch.active = Boolean(input.active);
  }

  const merged = {
    id: existing.id,
    productId: existing.productId,
    name: (patch.name as string) ?? existing.name,
    selectionMode: mode,
    minSelections,
    maxSelections,
    sortOrder: existing.sortOrder,
    active: (patch.active as boolean) ?? existing.active,
  };

  try {
    assertOptionGroup(merged);
  } catch (error) {
    if (error instanceof DomainError) {
      return err({ code: error.code, message: error.message });
    }
    return err({
      code: "INVALID_GROUP",
      message: "Los datos del grupo no son válidos.",
    });
  }

  const updated = await deps.updateOptionGroup(merchantId, groupId, patch);
  if (!updated) {
    return err({
      code: "GROUP_NOT_FOUND",
      message: "El grupo de opciones no existe.",
    });
  }
  return ok({ id: updated.id });
}

export async function createOptionChoice(
  merchantId: string,
  input: {
    groupId: string;
    name: string;
    priceDeltaInput?: string;
  },
  deps: OptionDeps,
): Promise<Result<{ id: string }, CatalogApplicationError>> {
  await deps.requireCatalogAccess(merchantId);

  if (!isValidUuid(input.groupId)) {
    return err({
      code: "GROUP_NOT_FOUND",
      message: "El grupo de opciones no existe.",
    });
  }

  const group = await deps.findOptionGroupById(merchantId, input.groupId);
  if (!group) {
    return err({
      code: "GROUP_NOT_FOUND",
      message: "El grupo no pertenece a este comercio.",
    });
  }

  const nameError = validateOptionName(input.name);
  if (nameError) {
    return err({ code: "INVALID_NAME", message: nameError });
  }

  let priceDeltaCents = 0;
  if (input.priceDeltaInput !== undefined && input.priceDeltaInput.trim()) {
    try {
      priceDeltaCents = parseMoneyInputToCents(input.priceDeltaInput);
    } catch (error) {
      if (error instanceof DomainError) {
        return err({ code: error.code, message: error.message });
      }
      return err({
        code: "INVALID_PRICE",
        message: "El precio delta no es válido.",
      });
    }
  }

  try {
    assertOptionChoice({
      id: "draft" as const,
      groupId: input.groupId,
      name: input.name.trim(),
      priceDeltaCents: moneyCents(priceDeltaCents),
      sortOrder: 0,
      active: true,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return err({ code: error.code, message: error.message });
    }
    return err({
      code: "INVALID_CHOICE",
      message: "Los datos de la opción no son válidos.",
    });
  }

  const sortOrder = await deps.nextOptionChoiceSortOrder(input.groupId);
  const choice = await deps.insertOptionChoice({
    groupId: input.groupId,
    name: input.name.trim(),
    priceDeltaCents,
    sortOrder,
    active: true,
  });

  return ok({ id: choice.id });
}

export async function updateOptionChoice(
  merchantId: string,
  choiceId: string,
  input: {
    name?: string;
    priceDeltaInput?: string;
    active?: boolean;
  },
  deps: OptionDeps,
): Promise<Result<{ id: string }, CatalogApplicationError>> {
  await deps.requireCatalogAccess(merchantId);

  if (!isValidUuid(choiceId)) {
    return err({
      code: "CHOICE_NOT_FOUND",
      message: "La opción no existe.",
    });
  }

  const existing = await deps.findOptionChoiceById(merchantId, choiceId);
  if (!existing) {
    return err({
      code: "CHOICE_NOT_FOUND",
      message: "La opción no existe.",
    });
  }

  const group = await deps.findOptionGroupById(merchantId, existing.groupId);
  if (!group) {
    return err({
      code: "GROUP_NOT_FOUND",
      message: "El grupo no pertenece a este comercio.",
    });
  }

  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const nameError = validateOptionName(input.name);
    if (nameError) {
      return err({ code: "INVALID_NAME", message: nameError });
    }
    patch.name = input.name.trim();
  }

  if (input.priceDeltaInput !== undefined) {
    try {
      patch.priceDeltaCents = parseMoneyInputToCents(
        input.priceDeltaInput.trim() || "0",
      );
    } catch (error) {
      if (error instanceof DomainError) {
        return err({ code: error.code, message: error.message });
      }
      return err({
        code: "INVALID_PRICE",
        message: "El precio delta no es válido.",
      });
    }
  }

  if (input.active !== undefined) {
    patch.active = Boolean(input.active);
  }

  const updated = await deps.updateOptionChoice(merchantId, choiceId, patch);
  if (!updated) {
    return err({
      code: "CHOICE_NOT_FOUND",
      message: "La opción no existe.",
    });
  }
  return ok({ id: updated.id });
}
