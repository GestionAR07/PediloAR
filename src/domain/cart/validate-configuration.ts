import { assertOptionSelections } from "@/domain/catalog/options";
import type { OptionSelectionMode } from "@/domain/catalog/enums";
import { moneyCents } from "@/domain/money/money-cents";
import type { CartGroupConfiguration } from "./types";

export type ConfiguratorGroupDefinition = {
  id: string;
  name: string;
  selectionMode: OptionSelectionMode | string;
  minSelections: number;
  maxSelections: number;
  active?: boolean;
  choices: Array<{
    id: string;
    name: string;
    priceDeltaCents: number;
    active?: boolean;
  }>;
};

export type ConfiguratorDraftSelection = {
  groupId: string;
  selections: Array<{ choiceId: string; quantity: number }>;
};

export function isConfiguratorSelectionValid(
  groups: readonly ConfiguratorGroupDefinition[],
  draft: readonly ConfiguratorDraftSelection[],
): boolean {
  try {
    for (const group of groups) {
      const draftGroup = draft.find((entry) => entry.groupId === group.id);
      const selections = draftGroup?.selections ?? [];
      assertOptionSelections(
        {
          id: group.id,
          productId: "product",
          name: group.name,
          selectionMode: group.selectionMode as OptionSelectionMode,
          minSelections: group.minSelections,
          maxSelections: group.maxSelections,
          sortOrder: 0,
          active: group.active ?? true,
        },
        group.choices.map((choice) => ({
          id: choice.id,
          groupId: group.id,
          name: choice.name,
          priceDeltaCents: moneyCents(choice.priceDeltaCents),
          sortOrder: 0,
          active: choice.active ?? true,
        })),
        selections,
      );
    }
    return true;
  } catch {
    return false;
  }
}

export function buildCartConfigurationFromDraft(
  groups: readonly ConfiguratorGroupDefinition[],
  draft: readonly ConfiguratorDraftSelection[],
): CartGroupConfiguration[] {
  const configuration: CartGroupConfiguration[] = [];

  for (const group of groups) {
    const draftGroup = draft.find((entry) => entry.groupId === group.id);
    const selections = (draftGroup?.selections ?? [])
      .map((selection) => {
        const choice = group.choices.find(
          (candidate) => candidate.id === selection.choiceId,
        );
        if (!choice || selection.quantity < 1) {
          return null;
        }
        return {
          choiceId: choice.id,
          choiceName: choice.name,
          quantity: selection.quantity,
          priceDeltaCents: moneyCents(choice.priceDeltaCents),
        };
      })
      .filter((value): value is NonNullable<typeof value> => value != null);

    if (selections.length === 0 && group.minSelections === 0) {
      continue;
    }

    configuration.push({
      groupId: group.id,
      groupName: group.name,
      selectionMode:
        group.selectionMode as CartGroupConfiguration["selectionMode"],
      selections,
    });
  }

  return configuration;
}

export function formatConfigurationSummary(
  configuration: readonly CartGroupConfiguration[],
): string[] {
  return configuration.map((group) => {
    const parts = group.selections.map((selection) =>
      group.selectionMode === "QUANTITY"
        ? `${selection.quantity} ${selection.choiceName}`
        : selection.choiceName,
    );
    return `${group.groupName}: ${parts.join(" · ")}`;
  });
}
