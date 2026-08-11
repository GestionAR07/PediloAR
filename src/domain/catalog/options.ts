import { assertPriceDeltaCents } from "../money/money-cents";
import { DomainError } from "../shared/errors";
import type { ProductOptionChoice, ProductOptionGroup } from "./types";

export type OptionSelectionInput = {
  choiceId: string;
  /** For SINGLE/MULTIPLE: typically 1 per selected choice. For QUANTITY: units of that choice. */
  quantity: number;
};

export function assertOptionGroup(group: ProductOptionGroup): void {
  if (!group.name.trim()) {
    throw new DomainError(
      "OPTION_GROUP_NAME_REQUIRED",
      "Option group name is required",
    );
  }

  if (
    !Number.isInteger(group.minSelections) ||
    !Number.isInteger(group.maxSelections) ||
    group.minSelections < 0 ||
    group.maxSelections < 0
  ) {
    throw new DomainError(
      "OPTION_GROUP_BOUNDS_INVALID",
      "min/max selections must be non-negative integers",
    );
  }

  if (group.maxSelections < group.minSelections) {
    throw new DomainError(
      "OPTION_GROUP_BOUNDS_INVERTED",
      "maxSelections must be >= minSelections",
    );
  }

  if (group.selectionMode === "SINGLE") {
    if (group.minSelections > 1 || group.maxSelections > 1) {
      throw new DomainError(
        "OPTION_GROUP_SINGLE_BOUNDS",
        "SINGLE groups allow at most one selection",
      );
    }
  }
}

export function assertOptionChoice(choice: ProductOptionChoice): void {
  if (!choice.name.trim()) {
    throw new DomainError(
      "OPTION_CHOICE_NAME_REQUIRED",
      "Option choice name is required",
    );
  }
  assertPriceDeltaCents(choice.priceDeltaCents);
}

function assertSelectionQuantities(
  selections: readonly OptionSelectionInput[],
): void {
  for (const selection of selections) {
    if (
      !Number.isInteger(selection.quantity) ||
      !Number.isSafeInteger(selection.quantity) ||
      selection.quantity < 1
    ) {
      throw new DomainError(
        "OPTION_SELECTION_INVALID_QUANTITY",
        "Each selection quantity must be a positive safe integer",
      );
    }
  }
}

/**
 * Validates a customer's selection against a group definition.
 * Does not look up catalog persistence — caller supplies active choices for the group.
 */
export function assertOptionSelections(
  group: ProductOptionGroup,
  choices: readonly ProductOptionChoice[],
  selections: readonly OptionSelectionInput[],
): void {
  assertOptionGroup(group);

  if (!group.active) {
    throw new DomainError(
      "OPTION_GROUP_INACTIVE",
      "Cannot select options from an inactive group",
    );
  }

  assertSelectionQuantities(selections);

  const choiceById = new Map(choices.map((choice) => [choice.id, choice]));
  const seen = new Set<string>();

  for (const selection of selections) {
    if (seen.has(selection.choiceId)) {
      throw new DomainError(
        "OPTION_SELECTION_DUPLICATE",
        "Duplicate choice in the same group",
      );
    }
    seen.add(selection.choiceId);

    const choice = choiceById.get(selection.choiceId);
    if (!choice || choice.groupId !== group.id) {
      throw new DomainError(
        "OPTION_SELECTION_UNKNOWN_CHOICE",
        "Selection refers to an unknown choice for this group",
      );
    }
    if (!choice.active) {
      throw new DomainError(
        "OPTION_SELECTION_INACTIVE_CHOICE",
        "Cannot select an inactive choice",
      );
    }
    assertOptionChoice(choice);
  }

  if (group.selectionMode === "SINGLE") {
    const distinct = selections.length;
    if (distinct < group.minSelections || distinct > group.maxSelections) {
      throw new DomainError(
        "OPTION_SELECTION_COUNT",
        "SINGLE selection count is outside allowed bounds",
      );
    }
    for (const selection of selections) {
      if (selection.quantity !== 1) {
        throw new DomainError(
          "OPTION_SELECTION_SINGLE_QUANTITY",
          "SINGLE selections must use quantity 1",
        );
      }
    }
    return;
  }

  if (group.selectionMode === "MULTIPLE") {
    const distinct = selections.length;
    if (distinct < group.minSelections || distinct > group.maxSelections) {
      throw new DomainError(
        "OPTION_SELECTION_COUNT",
        "MULTIPLE selection count is outside allowed bounds",
      );
    }
    for (const selection of selections) {
      if (selection.quantity !== 1) {
        throw new DomainError(
          "OPTION_SELECTION_MULTIPLE_QUANTITY",
          "MULTIPLE selections must use quantity 1 per choice",
        );
      }
    }
    return;
  }

  if (group.selectionMode === "QUANTITY") {
    const totalQuantity = selections.reduce(
      (sum, selection) => sum + selection.quantity,
      0,
    );
    if (
      totalQuantity < group.minSelections ||
      totalQuantity > group.maxSelections
    ) {
      throw new DomainError(
        "OPTION_SELECTION_QUANTITY_TOTAL",
        "QUANTITY total is outside allowed bounds",
      );
    }
    return;
  }

  throw new DomainError(
    "OPTION_GROUP_UNKNOWN_MODE",
    "Unknown option selection mode",
  );
}
